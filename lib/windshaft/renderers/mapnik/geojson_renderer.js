var Timer = require('../../stats/timer');
var GeojsonSqlWrapper = require('./geojson_sql_wrapper');
var queue = require('queue-async');
var _ = require('underscore');
var step = require('step');
var assert = require('assert');

var queryUtils = require('../../utils/query_utils');

function GeojsonRenderer(cartoPSQL, layers) {
    this.cartoPSQL = cartoPSQL;
    this.layers = layers;
}

module.exports = GeojsonRenderer;

GeojsonRenderer.prototype.getTile = function(z, x, y, callback) {
    var self = this;

    var timer = new Timer();
    timer.start('render');

    var rendererGetTileQueue = queue(this.layers.length);

    this.layers.forEach(function(layer) {
        if (layer.type === 'mapnik' || layer.type === 'cartodb') {
            var coord = {x: x, y: y};
            rendererGetTileQueue.defer(self._getTileData.bind(self), self.cartoPSQL, coord, z, layer);
        }
    });

    rendererGetTileQueue.awaitAll(function (err, result) {
        timer.end('render');
        if (err) {
            return callback(err);
        }

        var stats = _.extend(timer.getTimes(), {
            'render-details': _.pluck(result, 'stats')
        });

        var geoJsonTiles = self._formatTileResponse(result);

        // FIXME: response's header shouldn't be here. it must be at server level
        callback(null, geoJsonTiles, { 'Content-Type': 'application/json' } , stats);
    });
};

GeojsonRenderer.prototype._formatTileResponse = function (result) {
    if (result.length === 1) {
        return result[0].data;
    }

    return {
        type: 'FeatureCollection',
        features: _.pluck(result, 'data')
    };
};

GeojsonRenderer.prototype._getTileData = function(cartoPSQL, coord, zoom, layer, callback) {
    var self = this;

    var geoJSONQueryContext = {
        coord: coord,
        zoom: zoom,
        layerSql: layer.options.sql,
        geomColumn: layer.options.geom_column || 'the_geom_webmercator'
    };

    step(
        function getInvolvedTablenamesInQueryLayer() {
            var next = this;

            self._getInvolvedTablenames(cartoPSQL, layer.options.sql, next);
        },
        function getExtraColumnsForGeoJSONProperties(err, previous) {
            assert.ifError(err);

            var next = this;

            self._getExtraColumnNames(cartoPSQL, previous.tablenames, function (err, result) {
                if (err) {
                    return next(err);
                }

                next(null, {
                    extraColumNames: result.extraColumNames,
                    stats: _.extend(previous.stats, result.stats)
                });
            });
        },
        function getGeoJSON(err, previous) {
            assert.ifError(err);

            var query = self._composeGeojsonQuery(_.extend(geoJSONQueryContext, {
                columns: previous.extraColumNames
            }));

            self._queryGeojson(cartoPSQL, query, function (err, result) {
                if (err) {
                    return callback(err);
                }

                callback(null, {
                    data: result.data,
                    stats: _.extend(previous.stats, result.stats)
                });
            });
        }
    );
};

GeojsonRenderer.prototype._getInvolvedTablenames = function (cartoPSQL, sql, next) {
    var self = this;

    var query = queryUtils.extractTableNames(sql);

    self._measureSQLQuery(cartoPSQL, query, 'tables', function (err, result) {
        if (err) {
            return next(err);
        }

        next(null, {
            tablenames: self._formatTablenames(result.data.rows[0].tablenames),
            stats: result.stats
        });
    });

};

GeojsonRenderer.prototype._getExtraColumnNames = function (cartoPSQL, tablenames, next) {
    var self = this;
    var extraColumnsQueue = queue(tablenames.length);

    tablenames.forEach(function (tablename) {
        var query = queryUtils.getAditionalColumnsQuery(tablename);
        extraColumnsQueue.defer(self._measureSQLQuery, cartoPSQL, query, 'columns');
    });

    extraColumnsQueue.awaitAll(function (err, results) {
        if (err) {
            return next(err);
        }

        next(null, {
            extraColumNames: self._formatExtraColumns(results),
            stats: _.pluck(_.pluck(results, 'stats'), 'query-columns')
        });
    });
};

GeojsonRenderer.prototype._composeGeojsonQuery = function (queryContext) {
    return new GeojsonSqlWrapper().wrap(queryContext);
};

GeojsonRenderer.prototype._queryGeojson = function (cartoPSQL, query, callback) {
    var self = this;

    this._measureSQLQuery(cartoPSQL, query, 'geojson', function (err, result) {
        if (err) {
            return callback(err);
        }

        callback(null, {
            data: self._formatGeoJSONData(result.data),
            stats: result.stats
        });
    });
};

GeojsonRenderer.prototype._measureSQLQuery = function (cartoPSQL, query, name, callback) {
    var timer = new Timer();
    var timerKey = 'query-' + name;

    timer.start(timerKey);
    cartoPSQL.query(query, function (err, data) {
        timer.end(timerKey);
        if (err) {
            return callback(err);
        }

        callback(null, {
            data: data,
            stats: timer.getTimes()
        });
    }, true);
};

GeojsonRenderer.prototype._formatGeoJSONData = function (data) {
    if (data && data.rows && data.rows[0] && data.rows[0].geojson && !data.rows[0].geojson.features) {
        data.rows[0].geojson.features = [];
    }

    return data.rows[0].geojson;
};

GeojsonRenderer.prototype._formatTablenames = function (tablenames) {
    return tablenames.map(function (tablename) {
        return tablename.split('.').pop();
    });
};

GeojsonRenderer.prototype._formatExtraColumns = function (results) {
    var extraColumNames = [];
    results.forEach(function (result) {
        var columns = _.pluck(result.data.rows, 'column_name');
        extraColumNames = extraColumNames.concat(columns);
    });
    return extraColumNames;
};
