require('./test_helper');
var step = require('step');
var assert = require('./assert');
var redis = require('redis');
var _ = require('underscore');
var querystring = require('querystring');
var mapnik = require('mapnik');
var Windshaft = require('../../lib/windshaft');
var ServerOptions = require('./server_options');

var DEFAULT_POINT_STYLE = [
    '#layer {',
    '  marker-fill: #FF6600;',
    '  marker-opacity: 1;',
    '  marker-width: 16;',
    '  marker-line-color: white;',
    '  marker-line-width: 3;',
    '  marker-line-opacity: 0.9;',
    '  marker-placement: point;',
    '  marker-type: ellipse;',
    '  marker-allow-overlap: true;',
    '}'
].join('');

module.exports = {
    createLayergroup: createLayergroup,

    singleLayerMapConfig: singleLayerMapConfig,
    defaultTableMapConfig: defaultTableMapConfig,

    getStaticBbox: getStaticBbox,
    getStaticCenter: getStaticCenter,
    getGrid: getGrid,
    getGridJsonp: getGridJsonp,
    getTorque: getTorque,
    getTile: getTile,
    getTileLayer: getTileLayer
};


var server = new Windshaft.Server(ServerOptions);
server.setMaxListeners(0);
var redisClient = redis.createClient(global.environment.redis.port);

var jsonContentType = 'application/json; charset=utf-8';
var pngContentType = 'image/png';

function createLayergroup(layergroupConfig, options, callback) {
    if (!callback) {
        callback = options;
        options = {
            method: 'POST',
            statusCode: 200
        };
    }

    var expectedResponse = {
        status: options.statusCode || 200,
        headers: {
            'Content-Type': 'application/json; charset=utf-8'
        }
    };

    step(
        function requestLayergroup() {
            var next = this;
            var request = layergroupRequest(layergroupConfig, options.method, options.callbackName, options.params);
            assert.response(server, request, expectedResponse, function (res, err) {
                next(err, res);
            });
        },
        function validateLayergroup(err, res) {
            assert.ok(!err, 'Failed to request layergroup');

            var parsedBody = JSON.parse(res.body);
            var layergroupid = parsedBody.layergroupid;

            if (layergroupid) {
                var redisKey = 'map_cfg|' + layergroupid;
                redisClient.del(redisKey, function (/*delErr*/) {
                    return callback(err, res, parsedBody);
                });
            } else {
                return callback(err, res, parsedBody);
            }
        }
    );
}

function layergroupRequest(layergroupConfig, method, callbackName, extraParams) {
    method = method || 'POST';

    var request = {
        url: '/database/windshaft_test/layergroup',
        headers: {
            'Content-Type': 'application/json'
        }
    };

    var urlParams = _.extend({}, extraParams);
    if (callbackName) {
        urlParams.callback = callbackName;
    }

    if (method.toUpperCase() === 'GET') {
        request.method = 'GET';
        urlParams.config = JSON.stringify(layergroupConfig);
    } else {
        request.method = 'POST';
        request.data = JSON.stringify(layergroupConfig);
    }

    if (Object.keys(urlParams).length) {
        request.url += '?' + querystring.stringify(urlParams);
    }

    return request;
}

function singleLayerMapConfig(sql, cartocss, cartocssVersion, interactivity) {
    return {
        version: '1.3.0',
        layers: [
            {
                type: 'mapnik',
                options: {
                    sql: sql,
                    cartocss: cartocss || DEFAULT_POINT_STYLE,
                    cartocss_version: cartocssVersion || '2.3.0',
                    interactivity: interactivity
                }
            }
        ]
    };
}

function defaultTableMapConfig(tableName, cartocss, cartocssVersion, interactivity) {
    return singleLayerMapConfig(defaultTableQuery(tableName), cartocss, cartocssVersion, interactivity);
}

function defaultTableQuery(tableName) {
    return _.template('SELECT * FROM <%= tableName %>', {tableName: tableName});
}

function getStaticBbox(layergroupConfig, west, south, east, north, width, height, expectedResponse, callback) {
    if (!callback) {
        callback = expectedResponse;
        expectedResponse = pngContentType;
    }

    var url = [
        'static',
        'bbox',
        '<%= layergroupid %>',
        [west, south, east, north].join(','),
        width,
        height
    ].join('/') + '.png';
    return getGeneric(layergroupConfig, url, expectedResponse, callback);
}

function getStaticCenter(layergroupConfig, zoom, lat, lon, width, height, expectedResponse, callback) {
    if (!callback) {
        callback = expectedResponse;
        expectedResponse = pngContentType;
    }

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
    return getGeneric(layergroupConfig, url, expectedResponse, callback);
}

function getGrid(layergroupConfig, layer, z, x, y, expectedResponse, callback) {
    if (!callback) {
        callback = expectedResponse;
        expectedResponse = jsonContentType;
    }

    var options = {
        layer: layer,
        z: z,
        x: x,
        y: y,
        format: 'grid.json'
    };
    return getLayer(layergroupConfig, options, expectedResponse, callback);
}

function getGridJsonp(layergroupConfig, layer, z, x, y, jsonpCallbackName, expectedResponse, callback) {
    if (!callback) {
        callback = expectedResponse;
        expectedResponse = jsonContentType;
    }

    var options = {
        layer: layer,
        z: z,
        x: x,
        y: y,
        format: 'grid.json',
        jsonpCallbackName: jsonpCallbackName
    };
    return getLayer(layergroupConfig, options, expectedResponse, callback);
}

function getTorque(layergroupConfig, layer, z, x, y, expectedResponse, callback) {
    if (!callback) {
        callback = expectedResponse;
        expectedResponse = jsonContentType;
    }

    var options = {
        layer: layer,
        z: z,
        x: x,
        y: y,
        format: 'torque.json'
    };
    return getLayer(layergroupConfig, options, expectedResponse, callback);
}

function getTile(layergroupConfig, z, x, y, expectedResponse, callback) {
    if (!callback) {
        callback = expectedResponse;
        expectedResponse = pngContentType;
    }

    var options = {
        z: z,
        x: x,
        y: y,
        format: 'png'
    };
    return getLayer(layergroupConfig, options, expectedResponse, callback);
}

function getTileLayer(layergroupConfig, options, expectedResponse, callback) {
    if (!callback) {
        callback = expectedResponse;
        expectedResponse = pngContentType;
    }

    return getLayer(layergroupConfig, options, expectedResponse, callback);
}

function getLayer(layergroupConfig, options, expectedResponse, callback) {
    return getGeneric(layergroupConfig, tileUrlStrategy(options), expectedResponse, callback);
}

function tileUrlStrategy(options) {
    var urlLayerPattern = [
        '<%= layer %>',
        '<%= z %>',
        '<%= x %>',
        '<%= y %>'
    ].join('/') + '.<%= format %>';

    if (options.jsonpCallbackName) {
        urlLayerPattern += '?callback=<%= jsonpCallbackName %>';
    }

    var urlNoLayerPattern = [
        '<%= z %>',
        '<%= x %>',
        '<%= y %>'
    ].join('/') + '.<%= format %>';

    var urlTemplate = _.template((options.layer === undefined) ? urlNoLayerPattern : urlLayerPattern);

    options.format = options.format || 'png';

    return '<%= layergroupid %>/' + urlTemplate(_.defaults(options, { z: 0, x: 0, y: 0, layer: 0 }));
}

function getGeneric(layergroupConfig, url, expectedResponse, callback) {
    if (_.isString(expectedResponse)) {
        expectedResponse = {
            status: 200,
            headers: {
                'Content-Type': expectedResponse
            }
        };
    }
    var contentType = expectedResponse.headers['Content-Type'];

    var layergroupid = null;

    step(
        function requestLayergroup() {
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

            assert.response(server, request, expectedResponse, function (res, err) {
                next(err, res);
            });
        },
        function validateTile(err, res) {
            assert.ok(!err, 'Failed to get tile');
            var redisKey = 'map_cfg|' + layergroupid;

            var img;
            if (contentType === pngContentType) {
                img = new mapnik.Image.fromBytesSync(new Buffer(res.body, 'binary'));
            }

            redisClient.del(redisKey, function (/*delErr*/) {
                return callback(err, res, img);
            });
        }
    );
}
