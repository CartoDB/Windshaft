require('./test_helper');
var step = require('step');
var assert = require('./assert');
var redis = require('redis');
var _ = require('underscore');
var Windshaft = require('../../lib/windshaft');
var ServerOptions = require('./server_options');

module.exports = {
    getGrid: getGrid,
    getTile: getTile,
    getTileLayer: getTileLayer,
    getTorque: getTorque,
    getStaticCenter: getStaticCenter,
    getStaticBbox: getStaticBbox
};


var server = new Windshaft.Server(ServerOptions);
server.setMaxListeners(0);
var redisClient = redis.createClient(global.environment.redis.port);

var jsonContentType = 'application/json; charset=utf-8';
var pngContentType = 'image/png';

function getStaticBbox(layergroupConfig, west, south, east, north, width, height, callback) {
    var url = [
        'static',
        'bbox',
        '<%= layergroupid %>',
        [west, south, east, north].join(','),
        width,
        height
    ].join('/') + '.png';
    return getGeneric(layergroupConfig, url, pngContentType, callback);
}

function getStaticCenter(layergroupConfig, zoom, lat, lon, width, height, callback) {
    var url = [
        'static',
        'center',
        '<%= layergroupid %>',
        zoom,
        lat,
        lon,
        width,
        height
    ].join('/') + '.png';
    return getGeneric(layergroupConfig, url, pngContentType, callback);
}

function getGrid(layergroupConfig, layer, z, x, y, callback) {
    var options = {
        layer: layer,
        z: z,
        x: x,
        y: y,
        format: 'grid.json'
    };
    return getLayer(layergroupConfig, options, jsonContentType, callback);
}

function getTorque(layergroupConfig, layer, z, x, y, callback) {
    var options = {
        layer: layer,
        z: z,
        x: x,
        y: y,
        format: 'torque.json'
    };
    return getLayer(layergroupConfig, options, jsonContentType, callback);
}

function getTile(layergroupConfig, z, x, y, callback) {
    var options = {
        z: z,
        x: x,
        y: y,
        format: 'png'
    };
    return getLayer(layergroupConfig, options, pngContentType, callback);
}

function getTileLayer(layergroupConfig, options, callback) {
    return getLayer(layergroupConfig, options, pngContentType, callback);
}

function getLayer(layergroupConfig, options, contentType, callback) {
    var urlLayerPattern = [
        '<%= layer %>',
        '<%= z %>',
        '<%= x %>',
        '<%= y %>'
    ].join('/') + '.<%= format %>';

    var urlNoLayerPattern = [
        '<%= z %>',
        '<%= x %>',
        '<%= y %>'
    ].join('/') + '.<%= format %>';

    var urlTemplate = _.template((options.layer === undefined) ? urlNoLayerPattern : urlLayerPattern);

    var format = options.format || 'png';

    var url = '<%= layergroupid %>/' + urlTemplate({
        z: options.z === undefined ? 0 : options.z,
        x: options.x === undefined ? 0 : options.x,
        y: options.y === undefined ? 0 : options.y,
        layer: options.layer === undefined ? 0 : options.layer,
        format: format
    });

    return getGeneric(layergroupConfig, url, contentType, callback);
}

function getGeneric(layergroupConfig, url, contentType, callback) {

    var layergroupid = null;

    step(
        function createLayergroup() {
            var next = this;
            var request = {
                url: '/database/windshaft_test/layergroup',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                data: JSON.stringify(layergroupConfig)
            };
            var expectedResponse = {
                status: 200,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                }
            };
            assert.response(server, request, expectedResponse, function (res, err) {
                next(err, res);
            });
        },
        function validateLayergroup(err, res) {
            assert.ok(!err, 'Failed to create layergroup');

            var parsedBody = JSON.parse(res.body);
            layergroupid = parsedBody.layergroupid;

            assert.ok(layergroupid);

            return res;
        },
        function requestTile(err, res) {
            assert.ok(!err, 'Invalid layergroup response: ' + res.body);

            var next = this;

            var finalUrl = '/database/windshaft_test/layergroup/' + _.template(url, {
                layergroupid: layergroupid
            });

            var request = {
                url: finalUrl,
                method: 'GET'
            };

            if (contentType === pngContentType) {
                request.encoding = 'binary';
            }

            var expectedResponse = {
                status: 200,
                headers: {
                    'Content-Type': contentType
                }
            };

            assert.response(server, request, expectedResponse, function (res, err) {
                next(err, res);
            });
        },
        function validateTile(err, res) {
            assert.ok(!err, 'Failed to get tile');

            return callback(err, res, createFinishFn(layergroupid));
        }
    );
}

function createFinishFn(layergroupid) {
    return function(done) {
        var redisKey = 'map_cfg|' + layergroupid;
        redisClient.del(redisKey, function (err) {
            return done(err);
        });
    };
}
