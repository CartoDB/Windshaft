var mapnik = require('mapnik');
var queue = require('queue-async');
var _ = require('underscore');

var Renderer = require('./renderer');
var BaseAdaptor = require('../base_adaptor');

function BlendFactory(rendererFactory) {
    this.rendererFactory = rendererFactory;
}

module.exports = BlendFactory;

var EMPTY_IMAGE_BUFFER = new mapnik.Image(256, 256).encodeSync('png');

BlendFactory.prototype.getName = function() {
    return 'blend';
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
        filteredLayers = layer.split(',').map(function(layerIdx) {
            return +layerIdx;
        });

        if (!filteredLayers.every(Number.isFinite)) {
            return callback(new Error('Invalid layer filtering'));
        }

        filteredLayers = filteredLayers.sort(function(a, b) { return a - b; });

        var uppermostLayerIdx = filteredLayers[filteredLayers.length - 1];
        var lowestLayerIdx = filteredLayers[0];

        if (lowestLayerIdx < 0 || uppermostLayerIdx >= mapLayers.length) {
            return callback(new Error('Invalid layer filtering'));
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
                done(err, renderer && renderer.getTile);
            };

            var rendererParams = _.extend(params, {layer: layerIndex});

            var layerType = mapConfig.layerType(layerIndex);

            var isMapnikLayer = layerType === 'mapnik';
            if (isMapnikLayer && hasMapnikLayer) {
                return cb(null, null);
            }

            var rendererOptions = {
                limits: limits
            };

            // Avoid failing because of timeouts or 404/errors in http layers
            if (layerType === 'http') {
                rendererOptions.onTileErrorStrategy = function(err, tile, headers, stats, format, callback) {
                    return callback(null, EMPTY_IMAGE_BUFFER, {'Content-Type': 'image/png'}, stats || {});
                };
            }

            self.rendererFactory.getRenderer(mapConfig, rendererParams, rendererOptions, cb);

            if (isMapnikLayer) {
                hasMapnikLayer = true;
            }
        }, params, mapConfig);
    });

    function rendererGetTileQueueFinish(err, getTiles) {
        getTiles = _.compact(getTiles);

        if (err) {
            return callback(err);
        }
        if (!getTiles) {
            return callback(new Error('No renderers'));
        }

        return callback(null, new Renderer(getTiles));
    }

    rendererGetTileQueue.awaitAll(rendererGetTileQueueFinish);
};
