'use strict';

require('../support/test_helper');

var assert = require('../support/assert');
var TestClient = require('../support/test_client');
var fs = require('fs');
var http = require('http');

describe('blend http fallback', function() {

    var IMG_TOLERANCE_PER_MIL = 20;

    var httpRendererResourcesServer;
    var testClient;

    before(function(done) {
        testClient = new TestClient(mapConfig);
        // Start a server to test external resources
        httpRendererResourcesServer = http.createServer( function(request, response) {
            if (request.url.match(/^\/error404\//)) {
                response.writeHead(404);
                response.end();
            } else {
                var filename = __dirname + '/../fixtures/http/light_nolabels-1-0-0.png';
                if (request.url.match(/^\/dark\//)) {
                    filename = __dirname + '/../fixtures/http/dark_nolabels-1-0-0.png';
                }
                fs.readFile(filename, {encoding: 'binary'}, function(err, file) {
                    response.writeHead(200);
                    response.write(file, "binary");
                    response.end();
                });
            }
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
                type: 'plain', // <- 0
                options: {
                    color: '#fabada'
                }
            },
            {
                type: 'http', // <- 1
                options: {
                    urlTemplate: 'http://127.0.0.1:8033/{s}/{z}/{x}/{y}.png',
                    subdomains: ['light']
                }
            },
            {
                type: 'http', // <- 2
                options: {
                    urlTemplate: 'http://127.0.0.1:8033/{s}/{z}/{x}/{y}.png',
                    subdomains: ['dark']
                }
            },
            {
                type: 'http', // <- 3
                options: {
                    urlTemplate: 'http://127.0.0.1:8033/{s}/{z}/{x}/{y}.png',
                    subdomains: ['error404']
                }
            },
            {
                type: 'mapnik', // <- 4
                options: {
                    sql: 'SELECT * FROM populated_places_simple_reduced',
                    cartocss: '#layer { marker-fill:red; } #layer { marker-width: 2; }',
                    cartocss_version: '2.3.0'
                }
            }
        ]
    };

    var filteredLayersSuite = [
        ['all'], // layers displayed: 2 + 4, skipping 3 as it fails
        [0, 4],
        [0, 3], // skips layer 3 as it fails
        [1, 2],
        [1, 3],
        [2, 3],
        [3, 4]
    ];

    function blendPngFixture(layers) {
        return './test/fixtures/blend/http_fallback/blend-layers-' + layers.join('.') + '-zxy-1.0.0.png';
    }

    filteredLayersSuite.forEach(function(filteredLayers) {
        var layerFilter = filteredLayers.join(',');

        it('should fallback on http error while blending layers ' + layerFilter + '/1/0/0.png', function (done) {
            testClient.getTile(1, 0, 0, {layer: layerFilter}, function(err, tile) {
                assert.imageEqualsFile(tile, blendPngFixture(filteredLayers), IMG_TOLERANCE_PER_MIL, function(err) {
                    assert.ifError(err);
                    done();
                });
            });
        });
    });

    it('should keep failing when http layer is requested individually', function(done) {
        testClient.getTile(1, 0, 0, {layer: 3}, function(err) {
            assert.ok(err);
            assert.equal(err.message, "Unable to fetch http tile: http://127.0.0.1:8033/error404/1/0/0.png [404]");
            done();
        });
    });
});
