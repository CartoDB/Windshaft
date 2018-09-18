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

        if (known) {
            timer.start('layer-metadata');
            return self._getLayergroupData(params, mapConfig, function(err, layergroupData) {
                timer.end('layer-metadata');

                if (err) {
                    return self._finishingFailed(err, mapConfig.id(), callback);
                }

                timer.end('createLayergroup');
                return callback(null, layergroupData, timer.getTimes());
            });
        }

        timer.start('validate');
        self._mapValidatorBackend.validate(validatorMapConfigProvider, function(err, isValid) {
            timer.end('validate');

            if (err || !isValid) {
                return self._finishingFailed(err, mapConfig.id(), callback);
            }

            return self._getLayergroupData(params, mapConfig, function(err, layergroupData) {
                timer.end('layer-metadata');

                if (err) {
                    return self._finishingFailed(err, mapConfig.id(), callback);
                }

                timer.end('createLayergroup');
                return callback(null, layergroupData, timer.getTimes());
            });
        });
    });
};

MapBackend.prototype._getLayergroupData = function(params, mapConfig, callback) {
    var self = this;

    let layergroupData = {
        layergroupid: mapConfig.id()
    };

    self._layerMetadata.getMetadata(self._rendererCache, params, mapConfig, function(err, layersMetadata) {
        if (err) {
            return callback(err);
        }

        if (layersMetadata) {
            layergroupData.metadata = {
                layers: layersMetadata
            };

            // backwards compatibility for torque
            var torqueMetadata = layersMetadata.reduce(function(acc, layer, layerId) {
                if (layer.type === 'torque') {
                    acc[layerId] = layer.meta;
                }
                return acc;
            }, {});
            if (Object.keys(torqueMetadata).length) {
                layergroupData.metadata.torque = torqueMetadata;
            }
        }

        return callback(null, layergroupData);
    });
};

MapBackend.prototype._finishingFailed = function(err, mapConfigId, callback) {
    this._mapStore.del(mapConfigId, function(delErr) {
        if (delErr) {
            debug(`Failed to delete MapConfig '${mapConfigId}' after: ${err.message}`);
        }

        return callback(err);
    });
};
