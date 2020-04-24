'use strict';

const debug = require('debug')('windshaft:backend:map');
const Timer = require('../stats/timer');
const layerMetadataFactory = require('../metadata');

module.exports = class MapBackend {
    constructor (rendererCache, mapStore, mapValidator) {
        this._rendererCache = rendererCache;
        this._mapStore = mapStore;
        this._mapValidator = mapValidator;
        this._layerMetadata = layerMetadataFactory();
    }

    createLayergroup (mapConfig, params, validatorMapConfigProvider, callback) {
        const timer = new Timer();
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
                return this._getLayergroupMetadata(params, mapConfig, timer, callback);
            }

            timer.start('validate');
            this._mapValidator.validate(validatorMapConfigProvider, (err, isValid) => {
                timer.end('validate');

                if (err || !isValid) {
                    return this._deleteMapConfigAfterError(err, mapConfig.id(), callback);
                }

                return this._getLayergroupMetadata(params, mapConfig, timer, callback);
            });
        });
    }

    _getLayergroupMetadata (params, mapConfig, timer, callback) {
        timer.start('layer-metadata');
        return this._getLayersMetadata(params, mapConfig, (err, layergroupData) => {
            timer.end('layer-metadata');

            if (err) {
                return this._deleteMapConfigAfterError(err, mapConfig.id(), callback);
            }

            timer.end('createLayergroup');
            return callback(null, layergroupData, timer.getTimes());
        });
    }

    _getLayersMetadata (params, mapConfig, callback) {
        const layergroupData = {
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
                const torqueMetadata = getTorqueMetadata(layersMetadata);
                if (torqueMetadata) {
                    layergroupData.metadata.torque = torqueMetadata;
                }
            }

            return callback(null, layergroupData);
        });
    }

    _deleteMapConfigAfterError (err, mapConfigId, callback) {
        this._mapStore.del(mapConfigId, function (delErr) {
            if (delErr) {
                debug(`Failed to delete MapConfig '${mapConfigId}' after: ${err.message}`);
            }

            return callback(err);
        });
    }
};

function getTorqueMetadata (layersMetadata) {
    const torqueMetadata = layersMetadata.reduce((acc, layer, layerId) => {
        if (layer.type === 'torque') {
            acc[layerId] = layer.meta;
        }
        return acc;
    }, {});

    if (Object.keys(torqueMetadata).length) {
        return torqueMetadata;
    }

    return false;
}
