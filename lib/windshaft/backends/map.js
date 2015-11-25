var assert = require('assert');

var _ = require('underscore');
var queue = require('queue-async');
var step = require('step');
var debug = require('debug')('windshaft:backend:map');
var PSQL = require('cartodb-psql');
var RendererParams = require('../renderers/renderer_params');
var queryUtils = require('../utils/query_utils');

var DummyMapConfigProvider = require('../models/providers/dummy_mapconfig_provider');
var Timer = require('../stats/timer');

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

            getLayersMetadata(self._rendererCache, params, mapConfig, function(err, layersMetadata) {
                if (err) {
                    self._mapStore.del(mapConfig.id(), function(delErr) {
                        if (delErr) {
                            debug("Failed to delete MapConfig '" + mapConfig.id() + " after: " + err);
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
                    return next();
                }
            });
        },
        function finish(err) {
            timer.end('createLayergroup');
            callback(err, response, timer.getTimes());
        }
    );
};

function getLayersMetadata(rendererCache, params, mapConfig, callback) {
    var metadata = [];

    var metaQueue = queue(mapConfig.getLayers().length);

    mapConfig.getLayers().forEach(function(layer, layerId) {
        var layerType = mapConfig.layerType(layerId);

        if (layerType === 'torque') {
            metaQueue.defer(getTorqueLayerMetadata, rendererCache, mapConfig, params, 'json.torque',layerId);
        } else if (layerType === 'mapnik') {
            metaQueue.defer(getMapnikLayerMetadata, layer, mapConfig, params);
        }
    });

    metaQueue.awaitAll(function (err, results) {
        if (err) {
            return callback(err);
        }

        if (!results) {
            return callback(null, null);
        }

        mapConfig.getLayers().forEach(function(layer, layerId) {
            var layerType = mapConfig.layerType(layerId);

            metadata[layerId] = {
                type: layerType,
                meta: results[layerId]
            };
        });

        return callback(err, metadata);
    });
}

/// Fetch metadata for a tileset in a MapConfig
//
/// @param rendererType a MapConfig renderer type (layer.type in MapConfig spec)
/// @param layerId layer index within the mapConfig
/// @param callback function(err, metadata) where metadata format
///
function getTorqueLayerMetadata(rendererCache, mapConfig, params, format, layerId, callback) {
    params = _.extend({}, params, {
        token: mapConfig.id(),
        format: format,
        layer: layerId
    });

    var renderer;

    step(
        function(){
            rendererCache.getRenderer(new DummyMapConfigProvider(mapConfig, params), this);
        },
        function(err, _renderer) {
            assert.ifError(err);
            renderer = _renderer;
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

function getMapnikLayerMetadata(layer, mapConfig, params, callback) {
    step(
        function getPGClient(err) {
            assert.ifError(err);

            var dbParams = RendererParams.dbParamsFromReqParams(params);
            _.extend(dbParams, mapConfig.getLayerDatasource(params.layer));

            return new PSQL(dbParams);
        },
        function fetchLayerTablenames(err, pg) {
            assert.ifError(err);

            var next = this;
            var query = queryUtils.extractTableNames(layer.options.sql);

            pg.query(query, function (err, result) {
                if (err) {
                    return next(err);
                }

                next(null, pg, result.rows[0].tablenames);
            });
        },

        function getTableStats(err, pg, tablenames) {
            assert.ifError(err);

            var tableQueue = queue(tablenames.length);

            tablenames.forEach(function (table) {
                tableQueue.defer(function (pg, table, done) {
                    var tableStats = {
                        type: 'table',
                        name: table,
                    };
                    var sql = [
                        'SELECT row_to_json(s) as result FROM(',
                        'select _postgis_stats(\'',
                        table,
                        '\'::regclass, \'the_geom\') as stats) as s',
                    ].join('');

                    pg.query(sql, function (err, resultTable) {
                        if (err) {
                            tableStats.features = -1;
                        } else {
                            try {
                                tableStats.features = JSON.parse(resultTable.rows[0].result.stats).table_features;
                            } catch (e) {
                                tableStats.features = -1;
                            }
                        }
                        done(null, tableStats);
                    });
                }, pg, table);
            });

            tableQueue.awaitAll(this);
        },
        function finnish(err, result) {
            if (err) {
                return callback(err);
            }

            callback(null, {
                stats: result
            });
        }
    );
}
