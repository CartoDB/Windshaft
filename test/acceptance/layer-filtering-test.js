'use strict';

require('../support/test-helper');

var assert = require('../support/assert');
var TestClient = require('../support/test-client');
var fs = require('fs');
var http = require('http');
const path = require('path');

describe('layer filtering', function () {
    var IMG_TOLERANCE_PER_MIL = 20;
    var httpRendererResourcesServer;
    var testClient;

    before(function (done) {
        testClient = new TestClient(mapConfig);
        // Start a server to test external resources
        httpRendererResourcesServer = http.createServer(function (request, response) {
            var filename = path.join(__dirname, '/../fixtures/http/light_nolabels-1-0-0.png');
            fs.readFile(filename, { encoding: 'binary' }, function (err, file) {
                assert.ifError(err);
                response.writeHead(200);
                response.write(file, 'binary');
                response.end();
            });
        });
        httpRendererResourcesServer.listen(8033, done);
    });

    after(function (done) {
        httpRendererResourcesServer.close(done);
    });

    var mapConfig = {
        version: '1.2.0',
        layers: [
            {
                id: 'plain0',
                type: 'plain',
                options: {
                    color: '#fabada'
                }
            },
            {
                id: 'http0',
                type: 'http',
                options: {
                    urlTemplate: 'http://127.0.0.1:8033/{s}/{z}/{x}/{y}.png',
                    subdomains: ['abcd']
                }
            },
            {
                id: 'mapnik0',
                type: 'mapnik',
                options: {
                    sql: 'SELECT * FROM populated_places_simple_reduced',
                    cartocss: '#layer { marker-fill:red; } #layer { marker-width: 2; }',
                    cartocss_version: '2.3.0'
                }
            },
            {
                id: 'mapnik1',
                type: 'mapnik',
                options: {
                    sql: 'SELECT * FROM populated_places_simple_reduced',
                    cartocss: '#layer { marker-fill:blue; } #layer { marker-width: 2; }',
                    cartocss_version: '2.3.0'
                }
            },
            {
                id: 'torque0',
                type: 'torque',
                options: {
                    sql: 'SELECT * FROM populated_places_simple_reduced',
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
                id: 'http1',
                type: 'http',
                options: {
                    urlTemplate: 'http://127.0.0.1:8033/{s}/{z}/{x}/{y}.png',
                    subdomains: ['abcd']
                }
            },
            {
                id: 'torque1',
                type: 'torque',
                options: {
                    sql: 'SELECT * FROM populated_places_simple_reduced ' +
                        'where the_geom && ST_MakeEnvelope(-90, 0, 90, 65)',
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
        [1, 2, 3, 4],
        [1, 2, 4],
        [1, 3, 4],
        [2, 3],
        [3, 2], // ordering doesn't matter
        [0, 2],
        [0, 3],
        ['mapnik0', 'mapnik1'],
        ['mapnik1', 'mapnik0'], // ordering doesn't matter
        ['plain0', 'mapnik0'],
        ['plain0', 'mapnik1']
    ];

    function getAssertFilepath (layers) {
        return './test/fixtures/layers/filter-layers-' + layers.join('.') + '-zxy-1.0.0.png';
    }

    filteredLayersSuite.forEach(function (filteredLayers) {
        var filteredLayersParam = filteredLayers.join(',');
        it('should filter layers on ' + filteredLayersParam + '/1/0/0.png', function (done) {
            var options = {
                layer: filteredLayersParam
            };

            testClient.getTile(1, 0, 0, options, function (err, tile) {
                if (err) {
                    return done(err);
                }

                var filepath = getAssertFilepath(filteredLayers);
                assert.imageEqualsFile(tile, filepath, IMG_TOLERANCE_PER_MIL, function (err) {
                    if (err) {
                        return done(err);
                    }

                    done();
                });
            });
        });
    });

    var errorFilteredLayersSuite = [
        ['wrongFilter0', 'mapnik1'],
        ['mapnik1', 'wrongFilter0'],
        ['mapnik', 'mapnik1'],
        ['blend', 'mapnik1'],
        ['mapnik1', 'http'],
        ['mapnik1', 'torque', 'plain0'],
        ['cartodb'],
        ['torque0', 'raster'],
        ['torque1', 'plain', 'plain0'],
        [0, 'mapnik1'], // mixing layer index and identifier should not work
        ['mapnik1', 0]
    ];

    errorFilteredLayersSuite.forEach(function (filteredLayers) {
        var filteredLayersParam = filteredLayers.join(',');
        it('should return error for bad layer filtering ' + filteredLayersParam + '/1/0/0.png', function (done) {
            var options = {
                layer: filteredLayersParam
            };

            testClient.getTile(1, 0, 0, options, function (err) {
                assert.ok(err);
                assert.equal(err.message, 'Invalid layer filtering');
                done();
            });
        });
    });
});
