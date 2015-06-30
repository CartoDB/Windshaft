var assert = require('assert');

var _ = require('underscore');
var PSQL = require('cartodb-psql');
var queue = require('queue-async');
var step = require('step');

var Datasource = require('../models/datasource');
var MapConfig = require('../models/mapconfig');
var MapValidatorBackend = require('./map_validator');
var RendererParams = require('../renderers/renderer_params');
var Timer = require('../stats/timer');

function MapBackend(renderCache, mapStore, options) {
    options = options || {};

    this._renderCache = renderCache;
    this._mapStore = mapStore;

    // called before a layergroup configuration is created, it allows to modify the configuration
    // @param req request (body is the map configuration)
    // @param requestMapConfig layergroup map configuration
    // @param callback to be called with "err" as first argument
    this.beforeLayergroupCreate = options.beforeLayergroupCreate || function(req, requestMapConfig, callback) {
        return callback(null, requestMapConfig, Datasource.EmptyDatasource());
    };
    // called after a layergroup configuration is created
    // @param req request (body is the map configuration)
    // @param layergroup map configuration
    // @param response response object, can be modified
    // @param callback to be called with "err" as first argument
    this.afterLayergroupCreate = options.afterLayergroupCreate || function(req, layergroup, response, callback) {
        return callback(null);
    };

    this._mapValidatorBackend = new MapValidatorBackend(this);
}

module.exports = MapBackend;

MapBackend.prototype.createLayergroup = function(requestMapConfig, req, callback) {
    var self = this;

    req.profiler.start('createLayergroup');

    var response = {};

    // Inject db parameters into the configuration
    // to ensure getting different identifiers for
    // maps created against different databases
    // or users. See
    // https://github.com/CartoDB/Windshaft/issues/163
    requestMapConfig.dbparams = {
        name: req.params.dbname,
        user: req.params.dbuser
    };

    var mapConfig;

    step(
        function preLayerCreate() {
            self.beforeLayergroupCreate(req, requestMapConfig, this);
        },
        function initLayergroup(err, layergroupMapConfig, datasource) {
            assert.ifError(err);

            mapConfig = new MapConfig(layergroupMapConfig, datasource || Datasource.EmptyDatasource());

            // will save only if successful
            self._mapStore.save(mapConfig, this);
        },
        function handleMapConfigSave(err, mapConfigId, known) {
            req.profiler.done('mapSave');

            assert.ifError(err);

            response.layergroupid = mapConfig.id();

            if (known) {
                return true;
            } else {
                var next = this;
                self._mapValidatorBackend.validate(req, mapConfig, function(err, isValid) {
                    req.profiler.done('validate');
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

            self.getLayersMetadata(req, mapConfig, function(err, layersMetadata) {
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
            self.afterLayergroupCreate(req, mapConfig.obj(), response, this);
        },
        function finish(err) {
            if (!err) {
                req.profiler.done('afterLayergroupCreate');
            }
            req.profiler.end();
            callback(err, response);
        }
    );
};


// Gets a tile for a given set of tile ZXY coords. (OSM style)
// Call with .png for images, or .grid.json for UTFGrid tiles
//
// query string arguments:
//
// * sql - use SQL to filter displayed results or perform operations pre-render
// * style - assign a per tile style using carto
// * interactivity - specify which columns to represent in the UTFGrid
// * cache_buster - specify to ensure a new renderer is used
// * geom_type - specify default style to use if no style present
MapBackend.prototype.getTileOrGrid = function(req, res, callback){

    var self = this;

    req.profiler.start('getTileOrGrid');

    var renderer;

    step(
        function() {
            if (req.params.format === 'grid.json' && !req.params.interactivity) {
                if ( ! req.params.token ) { // token embeds interactivity
                    throw new Error("Missing interactivity parameter");
                }
            }
            self._renderCache.getRenderer(req, this);

        },
        function(err, r, is_cached) {
            req.profiler.done('getRenderer');
            renderer = r;
            if ( is_cached ) {
                res.header('X-Windshaft-Cache', Date.now() - renderer.ctime);
            }
            assert.ifError(err);
            renderer.getTile(+req.params.z, +req.params.x, +req.params.y, this);
        },
        function(err, tile, headers, stats) {
            req.profiler.done('render-'+req.params.format.replace('.','-'));
            req.profiler.add(stats || {});

            if ( renderer ) {
                renderer.release();
                req.profiler.done('renderer_release');
            }
            // this should end getTileOrGrid profile task
            req.profiler.end();
            callback(err, req, res, tile, headers);
        }
    );
};

/// Gets attributes for a given layer feature
//
/// Calls req2params, then expects parameters:
///
/// * token - MapConfig identifier
/// * layer - Layer number
/// * fid   - Feature identifier
///
/// The referenced layer must have been configured
/// to allow for attributes fetching.
/// See https://github.com/CartoDB/Windshaft/wiki/MapConfig-1.1.0
///
/// @param testMode if true generates a call returning requested
///                 columns plus the fid column of the first record
///                 it is only meant to check validity of configuration
///
MapBackend.prototype.getFeatureAttributes = function (params, testMode, callback) {
    var self = this;

    var timer = new Timer();

    var mapConfig;
    step(
        function getMapConfig() {
            timer.start('MapStore.load');
            self._mapStore.load(params.token, this);
        },
        function getPGClient(err, data) {
            assert.ifError(err);

            timer.end('MapStore.load');
            mapConfig = data;

            var dbParams = RendererParams.dbParamsFromReqParams(params);
            _.extend(dbParams, mapConfig.getLayerDatasource(params.layer));
            return new PSQL(dbParams);
        },
        function getAttributes(err, pg) {
            timer.start('getAttributes');

            assert.ifError(err);

            var layer = mapConfig.getLayer(params.layer);
            if ( ! layer ) {
                throw new Error("Map " + params.token +
                    " has no layer number " + params.layer);
            }
            var attributes = layer.options.attributes;
            if ( ! attributes ) {
                throw new Error("Layer " + params.layer +
                    " has no exposed attributes");
            }

            // NOTE: we're assuming that the presence of "attributes"
            //       means it is well-formed (should be checked at
            //       MapConfig construction/validation time).

            var fid_col = attributes.id;
            var att_cols = attributes.columns;

            // prepare columns with double quotes
            var quoted_att_cols = _.map(att_cols, function(n) {
                return pg.quoteIdentifier(n);
            }).join(',');

            if ( testMode ) {
                quoted_att_cols += ',' + pg.quoteIdentifier(fid_col);
            }

            var sql = 'select ' + quoted_att_cols + ' from ( ' + layer.options.sql + ' ) as _windshaft_subquery ';
            if ( ! testMode ) {
                sql += ' WHERE ' + pg.quoteIdentifier(fid_col) + ' = ' + params.fid;
            } else {
                sql += ' LIMIT 1';
            }

            // console.log("SQL:  " + sql);

            pg.query(sql, this, true); // use read-only transaction
        },
        function formatAttributes(err, data) {
            timer.end('getAttributes');
            assert.ifError(err);

            if ( data.rows.length !== 1 ) {
                if ( testMode ) {
                    return null;
                }
                else {
                    var rowsLengthError = new Error(data.rows.length +
                        " features in layer " + params.layer +
                        " of map " + params.token +
                        " are identified by fid " + params.fid);
                    if ( ! data.rows.length ) {
                        rowsLengthError.http_status = 404;
                    }
                    throw rowsLengthError;
                }
            }
            return data.rows[0];
        },
        function returnCallback(err, tile) {
            return callback(err, tile, timer.getTimes());
        }
    );
};

MapBackend.prototype.getLayersMetadata = function(req, mapConfig, callback) {
    var self = this;

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
        metadataQueue.defer(function(req, token, rendererType, layerId, done) {
            self.getLayerMetadata(req, token, rendererType, layerId, done);
        }, req, mapConfig.id(), 'json.torque', layerId);
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
};

/// Fetch metadata for a tileset in a MapConfig
//
/// @param rendererType a MapConfig renderer type (layer.type in MapConfig spec)
/// @param layerId layer index within the mapConfig
/// @param callback function(err, metadata) where metadata format
///
MapBackend.prototype.getLayerMetadata = function(req, token, format, layerId, callback) {
    var self = this;

    req = _.clone(req);
    req.params = _.clone(req.params);
    req.params.token = token;
    req.params.format = format;
    req.params.layer = layerId;

    var renderer;

    step(
        function(){
            self._renderCache.getRenderer(req, this);
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
};
