var assert = require('assert');

var _ = require('underscore');
var queue = require('queue-async');
var step = require('step');

var Datasource = require('../models/datasource');
var MapConfig = require('../models/mapconfig');
var Timer = require('../stats/timer');

function MapBackend(rendererCache, mapStore, mapValidatorBackend) {
    this._rendererCache = rendererCache;
    this._mapStore = mapStore;
    this._mapValidatorBackend = mapValidatorBackend;
}

module.exports = MapBackend;

MapBackend.prototype.createLayergroup = function(requestMapConfig, params, layergroupDecorator, callback) {
    var self = this;

    var timer = new Timer();
    timer.start('createLayergroup');

    var response = {};

    // Inject db parameters into the configuration
    // to ensure getting different identifiers for
    // maps created against different databases
    // or users. See
    // https://github.com/CartoDB/Windshaft/issues/163
    requestMapConfig.dbparams = {
        name: params.dbname,
        user: params.dbuser
    };

    var mapConfig;

    step(
        function preLayerCreate() {
            layergroupDecorator.beforeLayergroupCreate(requestMapConfig, this);
        },
        function initLayergroup(err, layergroupMapConfig, datasource) {
            assert.ifError(err);

            mapConfig = new MapConfig(layergroupMapConfig, datasource || Datasource.EmptyDatasource());

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
                self._mapValidatorBackend.validate(params, mapConfig, function(err, isValid) {
                    timer.end('validate');
                    if (isValid) {
                        return next(err);
                    }
                    self._mapStore.del(mapConfig.id(), function(delErr) {
                        if (delErr) {
                            console.error("Failed to delete MapConfig '" + mapConfig.id() + "' after: " + err);
                        }
                        return next(err);
                    });
                });
            }
        },
        function fetchLayersMetadata(err) {
            assert.ifError(err);

            var next = this;

            getLayersMetadata(self._rendererCache, params, mapConfig, function(err, layersMetadata) {
                if (err) {
                    self._mapStore.del(mapConfig.id(), function(delErr) {
                        if (delErr) {
                            console.error("Failed to delete MapConfig '" + mapConfig.id() + " after: " + err);
                        }
                        return next(err);
                    });
                } else {
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
                    return next(err);
                }
            });
        },
        function posLayerCreate(err) {
            assert.ifError(err);
            timer.start('afterLayergroupCreate');
            layergroupDecorator.afterLayergroupCreate(mapConfig.obj(), response, this);
        },
        function finish(err) {
            timer.end('afterLayergroupCreate');
            timer.end('createLayergroup');
            callback(err, response, timer.getTimes());
        }
    );
};

function getLayersMetadata(rendererCache, params, mapConfig, callback) {
    var metadata = [];

    var torqueLayers = [];

    mapConfig.getLayers().forEach(function(layer, layerId) {
        var layerType = mapConfig.layerType(layerId);
        metadata[layerId] = {
            type: layerType,
            meta: {}
        };

        if (layerType === 'torque') {
            torqueLayers.push(layerId);
        }
    });

    if ( ! torqueLayers.length ) {
        return callback(null, metadata);
    }

    var metadataQueue = queue(torqueLayers.length);

    torqueLayers.forEach(function(layerId) {
        metadataQueue.defer(function(rendererCache, params, token, rendererType, layerId, done) {
            getLayerMetadata(rendererCache, params, token, rendererType, layerId, done);
        }, rendererCache, params, mapConfig.id(), 'json.torque', layerId);
    });

    function metadataQueueFinish(err, results) {
        if (err) {
            return callback(err, results);
        }
        if (!results) {
            return callback(null, null);
        }

        torqueLayers.forEach(function(layerId, i) {
            metadata[layerId] = {
                type: 'torque',
                meta: results[i]
            };
        });
        return callback(err, metadata);
    }

    metadataQueue.awaitAll(metadataQueueFinish);
}

/// Fetch metadata for a tileset in a MapConfig
//
/// @param rendererType a MapConfig renderer type (layer.type in MapConfig spec)
/// @param layerId layer index within the mapConfig
/// @param callback function(err, metadata) where metadata format
///
function getLayerMetadata(rendererCache, params, token, format, layerId, callback) {
    params = _.extend({}, params, {
        token: token,
        format: format,
        layer: layerId
    });

    var renderer;

    step(
        function(){
            rendererCache.getRenderer(params, this);
        },
        function(err, r) {
            assert.ifError(err);
            renderer = r;
            renderer.getMetadata(this);
        },
        function(err, meta) {
            if ( renderer ) {
                renderer.release();
            }
            callback(err, meta);
        }
    );
}
