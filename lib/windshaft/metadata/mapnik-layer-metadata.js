'use strict';

var queue = require('queue-async');
var PSQL = require('cartodb-psql');
var _ = require('underscore');
var assert = require('assert');
var step = require('step');
var RendererParams = require('../renderers/renderer_params');
var queryUtils = require('../utils/query_utils');

function MapnikLayerMetadata () {
    this._types = {
        mapnik: true,
        cartodb: true
    };
}

MapnikLayerMetadata.prototype.is = function (type) {
    return this._types[type] ? this._types[type] : false;
};

MapnikLayerMetadata.prototype.getMetadata = function (mapConfig, layer, layerId, params, rendererCache, callback) {
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
                    var query = queryUtils.getTableStats(table);

                    pg.query(query, function (err, resultTable) {
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
};

module.exports = MapnikLayerMetadata;
