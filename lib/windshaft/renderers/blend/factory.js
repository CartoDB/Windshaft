var mapnik = require('mapnik');
var queue = require('queue-async');
var _ = require('underscore');

var Renderer = require('./renderer');
var BaseAdaptor = require('../base_adaptor');
var layersFilter = require('../../utils/layer_filter');

function BlendFactory(rendererFactory) {
    this.rendererFactory = rendererFactory;
}

module.exports = BlendFactory;
const NAME = 'blend';
module.exports.NAME = NAME;

var EMPTY_IMAGE_BUFFER = new mapnik.Image(256, 256).encodeSync('png');

BlendFactory.prototype.getName = function() {
    return NAME;
};

BlendFactory.prototype.supportsFormat = function(format) {
    return format === 'png';
};

BlendFactory.prototype.getAdaptor = function(renderer, format, onTileErrorStrategy) {
    return new BaseAdaptor(renderer, format, onTileErrorStrategy);
};

BlendFactory.prototype.getRenderer = function(mapConfig, format, options, callback) {
    var self = this;

    var layer = options.layer;
    var params = options.params;
    var limits = options.limits;

    var mapLayers = mapConfig.getLayers();
    var filteredLayers = mapLayers.map(function(_layer, layerIdx) { return layerIdx; });

    if (layer !== 'all') {
        try {
            filteredLayers = layersFilter(mapConfig, mapLayers, layer);
        } catch (err) {
            return callback(err);
        }
    }

    var rendererGetTileQueue = queue(filteredLayers.length);

    var hasMapnikLayer = false;
    filteredLayers.forEach(function(layerIndex) {
        rendererGetTileQueue.defer(function (params, mapConfig, done) {
            var cb = function (err, renderer) {
                if (err) {
                    return done(err);
                }
                // in case of multiple mapnik layers it will callback with null, null
                // so we need to do the && hack. TODO find a better way to handle that scenario
                done(err, renderer);
            };

            var rendererParams = _.extend({}, params, {layer: layerIndex});

            var layerType = mapConfig.layerType(layerIndex);

            var isMapnikLayer = layerType === 'mapnik';
            if (isMapnikLayer && hasMapnikLayer) {
                return cb(null, null);
            }

            if (isMapnikLayer) {
                rendererParams.layer = getMapnikLayersFromFilter(mapConfig, filteredLayers);
            }

            var rendererOptions = {
                limits: limits
            };

            // Avoid failing because of timeouts or 404/errors in http layers
            if (layerType === 'http') {
                rendererOptions.onTileErrorStrategy = function(err, tile, headers, stats, format, callback) {
                    if (err.code === 'ETIMEDOUT') {
                        return callback(err, tile, headers, stats);
                    }
                    return callback(null, EMPTY_IMAGE_BUFFER, {'Content-Type': 'image/png'}, stats || {});
                };
            } else {
                rendererOptions.onTileErrorStrategy = function(err, tile, headers, stats, format, callback) {
                    if (err.message && err.message.match(/coordinates out of range/i)) {
                        return callback(null, EMPTY_IMAGE_BUFFER, {'Content-Type': 'image/png'}, stats || {});
                    }
                    return callback(err, tile, headers, stats);
                };
            }

            self.rendererFactory.getRenderer(mapConfig, rendererParams, rendererOptions, cb);

            if (isMapnikLayer) {
                hasMapnikLayer = true;
            }
        }, params, mapConfig);
    });

    function rendererGetTileQueueFinish(err, renderers) {
        renderers = _.compact(renderers);

        if (err) {
            return callback(err);
        }
        if (!renderers) {
            return callback(new Error('No renderers'));
        }

        return callback(null, new Renderer(renderers));
    }

    rendererGetTileQueue.awaitAll(rendererGetTileQueueFinish);
};

function getMapnikLayersFromFilter(mapConfig, filteredLayers) {
    return filteredLayers.filter(function (layerIndex) {
        return mapConfig.layerType(layerIndex) === 'mapnik';
    }).join(',');
}
