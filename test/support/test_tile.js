var step = require('step');
var assert = require('./assert');
var redis = require('redis');
var th = require('./test_helper');
var _ = require('underscore');
var Windshaft = require('../../lib/windshaft');
var ServerOptions = require('./server_options');

module.exports = testTile;


var server = new Windshaft.Server(ServerOptions);
server.setMaxListeners(0);
var redisClient = redis.createClient(global.environment.redis.port);

function testTile(layergroupConfig, options, callback) {

    var layergroupid = null;

    var urlLayerPatterParams = [
        '<%= layergroupid %>',
        '<%= layer %>',
        '<%= z %>',
        '<%= x %>',
        '<%= y %>'
    ].join('/') + '.<%= format %>';
    var urlLayerPattern = '/database/windshaft_test/layergroup/' + urlLayerPatterParams;

    var urlNoLayerPatterParams = [
        '<%= layergroupid %>',
        '<%= z %>',
        '<%= x %>',
        '<%= y %>'
    ].join('/') + '.<%= format %>';
    var urlNoLayerPattern = '/database/windshaft_test/layergroup/' + urlNoLayerPatterParams;

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

            var urlTemplate = _.template((options.layer === undefined) ? urlNoLayerPattern : urlLayerPattern);

            var format = options.format || 'png';

            var url = urlTemplate({
                layergroupid: layergroupid,
                z: options.z === undefined ? 0 : options.z,
                x: options.x === undefined ? 0 : options.x,
                y: options.y === undefined ? 0 : options.y,
                layer: options.layer === undefined ? 0 : options.layer,
                format: format
            });

            var request = {
                url: url,
                method: 'GET'
            };

            var expectedResponse = {
                status: 200,
                headers: {
                    'Content-Type': 'image/png'
                }
            };

            if (format.match(/json/)) {
                expectedResponse.headers['Content-Type'] = 'application/json; charset=utf-8';
            } else {
                request.encoding = 'binary';
            }

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
    }
}
