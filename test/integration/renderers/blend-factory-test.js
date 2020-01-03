'use strict';

require('../../support/test-helper.js');

var assert = require('assert');
var BlendRendererFactory = require('../../../lib/windshaft/renderers/blend/factory');
var RendererFactory = require('../../../lib/windshaft/renderers/renderer_factory');
var MapConfig = require('../../../lib/windshaft/models/mapconfig');

describe('renderer_http_factory_getRenderer', function () {
    function rendererOptions () {
        return {
            layer: Array.prototype.join.call(arguments, ','),
            params: {
                format: 'png'
            },
            limits: {}
        };
    }

    var rendererFactory = new RendererFactory({});
    var blendFactory = new BlendRendererFactory(rendererFactory);

    var mapConfig = MapConfig.create({
        layers: [
            {
                type: 'plain',
                options: {
                    color: 'red'
                }
            },
            {
                type: 'plain',
                options: {
                    color: 'green'
                }
            },
            {
                type: 'plain',
                options: {
                    color: 'blue'
                }
            }
        ]
    });

    describe('happy case', function () {
        it('getRenderer creates renderer for valid filtered layers', function (done) {
            blendFactory.getRenderer(mapConfig, 'png', rendererOptions(1, 2), function (err, renderer) {
                assert.ifError(err);
                assert.ok(renderer);
                done();
            });
        });
    });

    describe('error cases', function () {
        var suite = [
            {
                desc: 'getRenderer throws error for out of bounds layers',
                options: rendererOptions(0, 3)
            },
            {
                desc: 'getRenderer throws error for out of bounds layers',
                options: rendererOptions(-1, 1)
            },
            {
                desc: 'getRenderer throws error for non finite filtered layers',
                options: rendererOptions('p', 0)
            }
        ];

        suite.forEach(function (scenario) {
            it(scenario.desc, function (done) {
                blendFactory.getRenderer(mapConfig, 'png', scenario.options, function (err, renderer) {
                    assert.ok(err);
                    assert.ok(!renderer);
                    assert.equal(err.message, 'Invalid layer filtering');
                    done();
                });
            });
        });
    });
});
