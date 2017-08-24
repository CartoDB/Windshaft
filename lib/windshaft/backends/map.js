'use strict';

var assert = require('assert');
var step = require('step');
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

    step(
        function initLayergroup() {
            timer.start('mapSave');
            // will save only if successful
            self._mapStore.save(mapConfig, this);
        },
        function handleMapConfigSave(err, mapConfigId, known) {
            timer.end('mapSave');

            assert.ifError(err);

            response.layergroupid = mapConfig.id();

            if (known) {
                return true;
            } else {
                var next = this;
                timer.start('validate');
                self._mapValidatorBackend.validate(validatorMapConfigProvider, function(err, isValid) {
                    timer.end('validate');
                    if (isValid) {
                        return next(err);
                    }
                    self._mapStore.del(mapConfig.id(), function(delErr) {
                        if (delErr) {
                            debug("Failed to delete MapConfig '" + mapConfig.id() + "' after: " + err);
                        }
                        return next(err);
                    });
                });
            }
        },
        function fetchLayersMetadata(err) {
            assert.ifError(err);

            var next = this;

            self._layerMetadata.getMetadata(self._rendererCache, params, mapConfig, function(err, layersMetadata) {
                if (err) {
                    return self._mapStore.del(mapConfig.id(), function(delErr) {
                        if (delErr) {
                            debug("Failed to delete MapConfig '" + mapConfig.id() + " after: " + err);
                        }
                        return next(err);
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

                return next();
            });
        },
        function finish(err) {
            timer.end('createLayergroup');
            callback(err, response, timer.getTimes());
        }
    );
};
