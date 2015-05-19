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
            var layerType = mapConfig.layerType(layerIndex);
            var rendererParams = _.extend(params, {layer: layerIndex});
            switch (layerType) {
                case 'mapnik':
                    if (!hasMapnikLayer) {
                        hasMapnikLayer = true;
                        // We clone because makeRendererMapnik has side effects, for instance, removing the token key
                        self.rendererFactory.makeRendererMapnik(mapConfig, _.clone(rendererParams), limits, cb);
                    } else {
                        // see `cb` declaration to understand this
                        cb(null, null);
                    }
                    break;
                case 'http':
                    self.rendererFactory.makeRendererHttp(mapConfig, rendererParams, cb);
                    break;
                case 'torque':
                    // We need to force the png renderer for torque
                    var torqueRendererParams = _.defaults({format: 'torque.png'}, rendererParams);
                    self.rendererFactory.makeRendererTorque(mapConfig, torqueRendererParams, cb);
                    break;
                case 'plain':
                    self.rendererFactory.makeRendererPlain(mapConfig, rendererParams, cb);
                    break;
                default:
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
