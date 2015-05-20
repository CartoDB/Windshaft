var queue = require('queue-async');
var _ = require('underscore');

var Renderer = require('./renderer');
var BaseAdaptor = require('../base_adaptor');

function BlendFactory(rendererFactory) {
    this.rendererFactory = rendererFactory;
}

module.exports = BlendFactory;

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

    var params = options.params;
    var limits = options.limits;

    var mapLayers = mapConfig.getLayers();

    var rendererGetTileQueue = queue(mapLayers.length);


    var hasMapnikLayer = false;
    mapLayers.forEach(function(layer, layerIndex) {
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

            var isMapnikLayer = mapConfig.layerType(layerIndex) === 'mapnik';
            if (isMapnikLayer && hasMapnikLayer) {
                return cb(null, null);
            }

            self.rendererFactory.getRenderer(mapConfig, rendererParams, { limits: limits }, cb);

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
