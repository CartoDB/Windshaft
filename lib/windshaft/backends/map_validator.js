var queue = require('queue-async');
var _ = require('underscore');

var MapConfigProviderProxy = require('../models/providers/mapconfig_provider_proxy');

/**
 * @param {TileBackend} tileBackend
 * @param {AttributesBackend} attributesBackend
 * @constructor
 * @type {MapValidatorBackend}
 */
function MapValidatorBackend(tileBackend, attributesBackend) {
    this.tileBackend = tileBackend;
    this.attributesBackend = attributesBackend;
}

module.exports = MapValidatorBackend;

MapValidatorBackend.prototype.validate = function(mapConfigProvider, callback) {

    var self = this;

    mapConfigProvider.getMapConfig(function(err, mapConfig, params) {
        if (err) {
            return callback(err, false);
        }

        var token = mapConfig.id();

        var validateFnList = [];

        function validateMapnikTile() {
            return function(done) {
                self.tryFetchTileOrGrid(mapConfigProvider, _.clone(params), token, 'png', undefined, done);
            };
        }

        function validateMapnikGridJson(layerId) {
            return function(done) {
                self.tryFetchTileOrGrid(mapConfigProvider, _.clone(params), token, 'grid.json', layerId, done);
            };
        }

        function validateTorqueJson(layerId) {
            return function(done) {
                self.tryFetchTileOrGrid(mapConfigProvider, _.clone(params), token, 'json.torque', layerId, done);
            };
        }

        function validateAttributes(layerId) {
            return function(done) {
                self.tryFetchFeatureAttributes(mapConfigProvider, _.clone(params), token, layerId, done);
            };
        }

        var hasMapnikLayers = false;

        mapConfig.getLayers().forEach(function(layer, layerId) {

            var lyropt = layer.options;

            var layerType = mapConfig.layerType(layerId);

            if (layerType === 'mapnik') {

                if (!hasMapnikLayers) {
                    validateFnList.push(validateMapnikTile());
                    hasMapnikLayers = true;
                }

                if ( lyropt.interactivity ) {
                    validateFnList.push(validateMapnikGridJson(layerId));
                }
            } else if (layerType === 'torque') {
                validateFnList.push(validateTorqueJson(layerId));
            }

            // both 'cartodb' or 'torque' types can have attributes
            if ( lyropt.attributes ) {
                validateFnList.push(validateAttributes(layerId));
            }
        });

        var validationQueue = queue(validateFnList.length);

        validateFnList.forEach(function(validateFn) {
            validationQueue.defer(validateFn);
        });

        function validationQueueFinish(err) {
            return callback(err, !err);
        }

        validationQueue.awaitAll(validationQueueFinish);
    });
};

MapValidatorBackend.prototype.tryFetchTileOrGrid = function (mapConfigProvider, params, token, format, layerId,
                                                             callback) {
    params.token = token;
    params.format = format;
    params.layer = layerId;
    params.x = 0;
    params.y = 0;
    params.z = 30;

    this.tileBackend.getTile(new MapConfigProviderProxy(mapConfigProvider, params), params, callback);
};

MapValidatorBackend.prototype.tryFetchFeatureAttributes = function(mapConfigProvider, params, token, layernum,
                                                                   callback) {
    params.token = token;
    params.layer = layernum;

    var proxyProvider = new MapConfigProviderProxy(mapConfigProvider, params);
    this.attributesBackend.getFeatureAttributes(proxyProvider, params, true, callback);
};
