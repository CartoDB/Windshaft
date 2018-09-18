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
    this._mapStore.save(mapConfig, (err, mapConfigId, known) => {
        timer.end('mapSave');

        if (err) {
            return callback(err);
        }

        if (known) {
            return this._getDataAndFinish(params, mapConfig, timer, callback);
        }

        timer.start('validate');
        this._mapValidatorBackend.validate(validatorMapConfigProvider, (err, isValid) => {
            timer.end('validate');

            if (err || !isValid) {
                return this._returnError(err, mapConfig.id(), callback);
            }

            return this._getDataAndFinish(params, mapConfig, timer, callback);
        });
    });
};

MapBackend.prototype._getDataAndFinish = function(params, mapConfig, timer, callback) {
    timer.start('layer-metadata');
    return this._getLayergroupData(params, mapConfig, (err, layergroupData) => {
        timer.end('layer-metadata');

        if (err) {
            return this._returnError(err, mapConfig.id(), callback);
        }

        timer.end('createLayergroup');
        return callback(null, layergroupData, timer.getTimes());
    });
};

MapBackend.prototype._getLayergroupData = function(params, mapConfig, callback) {
    let layergroupData = {
        layergroupid: mapConfig.id()
    };

    this._layerMetadata.getMetadata(this._rendererCache, params, mapConfig, (err, layersMetadata) => {
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

MapBackend.prototype._returnError = function(err, mapConfigId, callback) {
    this._mapStore.del(mapConfigId, function(delErr) {
        if (delErr) {
            debug(`Failed to delete MapConfig '${mapConfigId}' after: ${err.message}`);
        }

        return callback(err);
    });
};
