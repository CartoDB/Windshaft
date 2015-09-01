require('../../support/test_helper.js');

var assert = require('assert');
var fs = require('fs');
var http = require('http');

var PlainRendererFactory = require('../../../lib/windshaft/renderers/plain/factory');
var ColorRenderer = require('../../../lib/windshaft/renderers/plain/renderer');
var MapConfig = require('../../../lib/windshaft/models/mapconfig');

describe('renderer_plain_factory_getRenderer', function() {

    var httpRendererResourcesServer;

    before(function(done) {
        // Start a server to test external resources
        httpRendererResourcesServer = http.createServer( function(request, response) {
            if (request.url.match(/fail/)) {
                response.writeHead(404);
                response.end();
                return;
            }
            var filename = __dirname + '/../../fixtures/plain/patterns/congruent_pentagon.png';
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

    function rendererOptions(layer) {
        return {
            layer: layer
        };
    }

    var factory = new PlainRendererFactory();

    it('getRenderer throws error for non plain layer', function(done) {
        var mapConfig = MapConfig.create({
            layers: [
                {
                    type: 'plain',
                    options: {
                        color: 'red'
                    }
                },
                {
                    type: 'http',
                    options: {
                        urlTemplate: 'http://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                        subdomains: ['abcd']
                    }
                }
            ]
        });
        factory.getRenderer(mapConfig, 'png', rendererOptions(1), function(err, renderer) {
            assert.ok(err);
            assert.ok(!renderer);
            assert.equal(err.message, "Layer is not a 'plain' layer");
            done();
        });
    });

    it('getRenderer throws error for non plain layer', function(done) {
        var mapConfig = MapConfig.create({
            layers: [
                {
                    type: 'plain',
                    options: {}
                }
            ]
        });
        factory.getRenderer(mapConfig, 'png', rendererOptions(0), function(err, renderer) {
            assert.ok(err);
            assert.ok(!renderer);
            assert.equal(
                err.message,
                "Plain layer: at least one of the options, `color` or `imageUrl`, must be provided."
            );
            done();
        });
    });

    var validColors = [
        'blue',
        '#fff',
        '#ffffff',
        [255,0,0],
        [255,0,0,128]
    ];

    validColors.forEach(function(color) {
        it('getRenderer works for valid color: ' + JSON.stringify(color), function(done) {
            var mapConfig = MapConfig.create({
                layers: [
                    {
                        type: 'plain',
                        options: {
                            color: color
                        }
                    }
                ]
            });
            factory.getRenderer(mapConfig, 'png', rendererOptions(0), function(err, renderer) {
                assert.ok(!err, err);
                assert.ok(renderer);
                done();
            });
        });
    });

    var invalidColors = [
        {
            color: '#hexcol',
            desc: "Invalid color for 'plain' layer: Failed to parse color: \"#hexcol\""
        },
        {
            color: 'wadus',
            desc: "Invalid color for 'plain' layer: Failed to parse color: \"wadus\""
        },
        {
            color: [],
            desc: "Invalid color for 'plain' layer: invalid integer array"
        },
        {
            color: [255],
            desc: "Invalid color for 'plain' layer: invalid integer array"
        },
        {
            color: [255,0],
            desc: "Invalid color for 'plain' layer: invalid integer array"
        },
        {
            color: [255,0,0,0,0],
            desc: "Invalid color for 'plain' layer: invalid integer array"
        }
    ];

    invalidColors.forEach(function(invalidColor) {
        it('getRenderer fails for invalid color: ' + JSON.stringify(invalidColor.color), function(done) {
            var mapConfig = MapConfig.create({
                layers: [
                    {
                        type: 'plain',
                        options: {
                            color: invalidColor.color
                        }
                    }
                ]
            });
            factory.getRenderer(mapConfig, 'png', rendererOptions(0), function(err, renderer) {
                assert.ok(err);
                assert.ok(!renderer);
                assert.equal(err.message, invalidColor.desc);
                done();
            });
        });
    });


    it('getRenderer works for valid imageUrl', function(done) {
        var mapConfig = MapConfig.create({
            layers: [
                {
                    type: 'plain',
                    options: {
                        imageUrl: 'http://127.0.0.1:8033/background_image.png'
                    }
                }
            ]
        });
        factory.getRenderer(mapConfig, 'png', rendererOptions(0), function(err, renderer) {
            assert.ok(!err, err);
            assert.ok(renderer);
            done();
        });
    });

    it('should fail to create renderer when imageUrl fails', function(done) {
        var mapConfig = MapConfig.create({
            layers: [
                {
                    type: 'plain',
                    options: {
                        imageUrl: 'http://127.0.0.1:8033/fail.png'
                    }
                }
            ]
        });
        factory.getRenderer(mapConfig, 'png', rendererOptions(0), function(err, renderer) {
            assert.ok(err);
            assert.ok(!renderer);
            assert.equal(
                err.message,
                "Invalid imageUrl for 'plain' layer: Unable to fetch http tile: http://127.0.0.1:8033/fail.png [404]"
            );
            done();
        });
    });

    it('getRenderer works with both options but returns color renderer', function(done) {
        var mapConfig = MapConfig.create({
            layers: [
                {
                    type: 'plain',
                    options: {
                        color: 'red',
                        imageUrl: 'http://127.0.0.1:8033/background_image.png'
                    }
                }
            ]
        });
        factory.getRenderer(mapConfig, 'png', rendererOptions(0), function(err, renderer) {
            assert.ok(!err, err);
            assert.ok(renderer);
            assert.equal(renderer.constructor, ColorRenderer);
            done();
        });
    });
});
