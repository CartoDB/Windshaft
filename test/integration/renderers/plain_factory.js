var assert = require('assert');
var PlainRendererFactory = require('../../../lib/windshaft/renderers/plain/factory');
var MapConfig = require('../../../lib/windshaft/models/mapconfig');

suite('renderer_plain_factory_getRenderer', function() {

    function rendererOptions(layer) {
        return {
            layer: layer
        };
    }

    var factory = new PlainRendererFactory();

    test('getRenderer throws error for non plain layer', function(done) {
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

    test('getRenderer throws error for non plain layer', function(done) {
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
            assert.equal(err.message, "Invalid color for 'plain' layer");
            done();
        });
    });
});
