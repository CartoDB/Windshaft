var assert = require('assert');
var HttpRendererFactory = require('../../../lib/windshaft/renderers/http/factory');
var HttpFallbackRenderer = require('../../../lib/windshaft/renderers/http/fallback_renderer');
var MapConfig = require('../../../lib/windshaft/models/mapconfig');

suite('renderer_http_factory_getRenderer', function() {

    var whitelistSample = [
        'http://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'http://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png'
    ];

    var invalidUrlTemplate = 'http://wadus.example.com/{z}/{x}/{y}.png';

    var layerZeroOptions = {
        layer: 0
    };

    var factory = new HttpRendererFactory(whitelistSample, 2000);

    test('getRenderer throws error for empty urlTemplate option', function(done) {
        var factory = new HttpRendererFactory(whitelistSample, 2000);
        var mapConfig = MapConfig.create({
            layers: [
                {
                    type: 'http',
                    options: {
                        subdomains: ['abcd']
                    }
                }
            ]
        });
        factory.getRenderer(mapConfig, 'png', layerZeroOptions, function(err, renderer) {
            assert.ok(err);
            assert.ok(!renderer);
            assert.equal(err.message, 'Missing mandatory "urlTemplate" option');
            done();
        });
    });

    test('getRenderer throws error for invalid urlTemplate', function(done) {
        var mapConfig = MapConfig.create({
            layers: [
                {
                    type: 'http',
                    options: {
                        urlTemplate: invalidUrlTemplate,
                        subdomains: ['abcd']
                    }
                }
            ]
        });
        factory.getRenderer(mapConfig, 'png', layerZeroOptions, function(err, renderer) {
            assert.ok(err);
            assert.ok(!renderer);
            assert.equal(err.message, 'Invalid "urlTemplate" for http layer');
            done();
        });
    });

    test('getRenderer returns a fallback image renderer for invalid urlTemplate', function(done) {
        var factoryWithFallbackImage = new HttpRendererFactory(
            whitelistSample, 2000, undefined, 'http://example.com/fallback.png'
        );
        var mapConfig = MapConfig.create({
            layers: [
                {
                    type: 'http',
                    options: {
                        urlTemplate: invalidUrlTemplate,
                        subdomains: ['abcd']
                    }
                }
            ]
        });
        factoryWithFallbackImage.getRenderer(mapConfig, 'png', layerZeroOptions, function(err, renderer) {
            assert.ok(!err);
            assert.ok(renderer);
            assert.equal(renderer.constructor, HttpFallbackRenderer);
            done();
        });
    });
});
