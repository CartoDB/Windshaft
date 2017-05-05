'use strict';

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
            _.extend(dbParams, mapConfig.getLayerDatasource(layerId));

            return new PSQL(dbParams);
        },
        function fetchLayerTablenames(err, pg) {
            assert.ifError(err);

            var next = this;

            if (Array.isArray(layer.options.affected_tables) && !!layer.options.affected_tables.join('')) {
                next(null, pg, layer.options.affected_tables);
                return;
            }

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
            var group = this.group();
            tablenames.forEach(function (table) {
                var next = group();
                var query = queryUtils.getTableStats(table, layer.options.geom_column);
                var tableStats = {
                    type: 'table',
                    name: table,
                };

                pg.query(query, function (err, res) {
                    if (err) {
                        tableStats.featureCount = -1;
                        tableStats.vertexCount = -1;
                    } else {
                        tableStats.featureCount = res.rows[0].features;
                        tableStats.vertexCount = res.rows[0].vertexes;
                    }
                    next(null, tableStats);
                });
            });
        },
        function finish(err, result) {
            if (err) {
                return callback(err);
            }

            callback(null, {
                cartocss: layer.options.cartocss,
                stats: result
            });
        }
    );
};

module.exports = MapnikLayerMetadata;
