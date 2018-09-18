'use strict';

var debug = require('debug')('windshaft:backend:map');
var Timer = require('../stats/timer');
var layerMetadataFactory = require('../metadata');

/**
 * @param {RendererCache} rendererCache
 * @param {MapStore} mapStore
 * @param {MapValidatorBackend} mapValidatorBackend
 * @constructor
 */
function MapBackend(rendererCache, mapStore, mapValidatorBackend) {
    this._rendererCache = rendererCache;
    this._mapStore = mapStore;
    this._mapValidatorBackend = mapValidatorBackend;
    this._layerMetadata = layerMetadataFactory();
}

module.exports = MapBackend;

MapBackend.prototype.createLayergroup = function(mapConfig, params, validatorMapConfigProvider, callback) {
    var self = this;

    var timer = new Timer();
    timer.start('createLayergroup');

    var response = {};

    // Inject db parameters into the configuration
    // to ensure getting different identifiers for
    // maps created against different databases
    // or users. See
    // https://github.com/CartoDB/Windshaft/issues/163
    mapConfig.setDbParams({
        name: params.dbname,
        user: params.dbuser
    });

    timer.start('mapSave');
    // will save only if successful
    self._mapStore.save(mapConfig, function (err, mapConfigId, known) {
        timer.end('mapSave');

        if (err) {
            return callback(err);
        }

        response.layergroupid = mapConfig.id();

        if (known) {
            return fetchLayersMetadata();
        }

        timer.start('validate');
        self._mapValidatorBackend.validate(validatorMapConfigProvider, function(err, isValid) {
            timer.end('validate');
            if (isValid) {
                return fetchLayersMetadata(err);
            }
            self._mapStore.del(mapConfig.id(), function(delErr) {
                if (delErr) {
                    debug("Failed to delete MapConfig '" + mapConfig.id() + "' after: " + err);
                }
                return callback(err);
            });
        });

    });

    function fetchLayersMetadata(err) {
        if (err) {
            return callback(err);
        }

        timer.start('layer-metadata');
        self._layerMetadata.getMetadata(self._rendererCache, params, mapConfig, function(err, layersMetadata) {
            timer.end('layer-metadata');
            if (err) {
                return self._mapStore.del(mapConfig.id(), function(delErr) {
                    if (delErr) {
                        debug("Failed to delete MapConfig '" + mapConfig.id() + " after: " + err);
                    }
                    return callback(err);
                });
            }

            if (layersMetadata) {
                response.metadata = response.metadata || {};
                response.metadata.layers = layersMetadata;

                // backwards compatibility for torque
                var torqueMetadata = layersMetadata.reduce(function(acc, layer, layerId) {
                    if (layer.type === 'torque') {
                        acc[layerId] = layer.meta;
                    }
                    return acc;
                }, {});
                if (Object.keys(torqueMetadata).length) {
                    response.metadata.torque = torqueMetadata;
                }
            }

            timer.end('createLayergroup');
            return callback(err, response, timer.getTimes());
        });
    }
};
