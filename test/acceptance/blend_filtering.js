require('../support/test_helper');

var assert = require('../support/assert');
var testClient = require('../support/test_client');
var fs = require('fs');
var http = require('http');

describe('blend layer filtering', function() {

    var IMG_TOLERANCE_PER_MIL = 20;

    var httpRendererResourcesServer;

    before(function(done) {
        // Start a server to test external resources
        httpRendererResourcesServer = http.createServer( function(request, response) {
            var filename = __dirname + '/../fixtures/http/light_nolabels-1-0-0.png';
            fs.readFile(filename, {encoding: 'binary'}, function(err, file) {
                response.writeHead(200);
                response.write(file, "binary");
                response.end();
            });
        });
        httpRendererResourcesServer.listen(8033, done);
    });

    after(function(done) {
        httpRendererResourcesServer.close(done);
    });

    var mapConfig = {
        version: '1.2.0',
        layers: [
            {
                type: 'plain',
                options: {
                    color: '#fabada'
                }
            },
            {
                type: 'http',
                options: {
                    urlTemplate: 'http://127.0.0.1:8033/{s}/{z}/{x}/{y}.png',
                    subdomains: ['abcd']
                }
            },
            {
                type: 'mapnik',
                options: {
                    sql: 'SELECT * FROM populated_places_simple_reduced',
                    cartocss: '#layer { marker-fill:red; } #layer { marker-width: 2; }',
                    cartocss_version: '2.3.0'
                }
            },
            {
                type: 'torque',
                options: {
                    sql: "SELECT * FROM populated_places_simple_reduced",
                    cartocss: [
                        'Map {',
                        '    buffer-size:0;',
                        '    -torque-frame-count:1;',
                        '    -torque-animation-duration:30;',
                        '    -torque-time-attribute:"cartodb_id";',
                        '    -torque-aggregation-function:"count(cartodb_id)";',
                        '    -torque-resolution:1;',
                        '    -torque-data-aggregation:linear;',
                        '}',
                        '#populated_places_simple_reduced{',
                        '    comp-op: multiply;',
                        '    marker-fill-opacity: 1;',
                        '    marker-line-color: #FFF;',
                        '    marker-line-width: 0;',
                        '    marker-line-opacity: 1;',
                        '    marker-type: rectangle;',
                        '    marker-width: 3;',
                        '    marker-fill: #FFCC00;',
                        '}'
                    ].join(' '),
                    cartocss_version: '2.3.0'
                }
            },
            {
                type: 'http',
                options: {
                    urlTemplate: 'http://127.0.0.1:8033/{s}/{z}/{x}/{y}.png',
                    subdomains: ['abcd']
                }
            },
            {
                type: 'torque',
                options: {
                    sql: "SELECT * FROM populated_places_simple_reduced " +
                        "where the_geom && ST_MakeEnvelope(-90, 0, 90, 65)",
                    cartocss: [
                        'Map {',
                        '    buffer-size:0;',
                        '    -torque-frame-count:1;',
                        '    -torque-animation-duration:30;',
                        '    -torque-time-attribute:"cartodb_id";',
                        '    -torque-aggregation-function:"count(cartodb_id)";',
                        '    -torque-resolution:1;',
                        '    -torque-data-aggregation:linear;',
                        '}',
                        '#populated_places_simple_reduced{',
                        '    comp-op: multiply;',
                        '    marker-fill-opacity: 1;',
                        '    marker-line-color: #FFF;',
                        '    marker-line-width: 0;',
                        '    marker-line-opacity: 1;',
                        '    marker-type: rectangle;',
                        '    marker-width: 3;',
                        '    marker-fill: #FFCC00;',
                        '}'
                    ].join(' '),
                    cartocss_version: '2.3.0'
                }
            }
        ]
    };

    var filteredLayersSuite = [
        [0, 1],
        [0, 2],
        [1, 2],
        [2, 1], // ordering doesn't matter
        [0, 3],
        [1, 3],
        [1, 2, 5],
        [1, 2, 3, 4]
    ];

    function blendPngFixture(layers) {
        return './test/fixtures/blend/blend-filtering-layers-' + layers.join('.') + '-zxy-1.0.0.png';
    }

    filteredLayersSuite.forEach(function(filteredLayers) {
        var layerFilter = filteredLayers.join(',');
        var tileRequest = {
            z: 1,
            x: 0,
            y: 0,
            layer: layerFilter,
            format: 'png'
        };

        it('should filter on ' + layerFilter + '/1/0/0.png', function (done) {
            testClient.getTileLayer(mapConfig, tileRequest, function(err, res) {
                assert.imageEqualsFile(res.body, blendPngFixture(filteredLayers), IMG_TOLERANCE_PER_MIL, function(err) {
                    assert.ok(!err);
                    done();
                });
            });
        });
    });
});
