var Timer = require('../../stats/timer');
var GeojsonSqlWrapper = require('./geojson_sql_wrapper');
var queue = require('queue-async');
var _ = require('underscore');
var step = require('step');
var assert = require('assert');

var queryUtils = require('../../utils/query_utils');

function GeojsonRenderer(cartoPSQL, layers, options) {
    this.cartoPSQL = cartoPSQL;
    this.layers = layers;
    this.options = options;
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
        geomColumn: layer.options.geom_column || 'the_geom_webmercator',
        clipByBox2d: this.options.clipByBox2d
    };

    step(
        function getColumnNames() {
            var next = this;

            self._getQueryColumnNames(cartoPSQL, layer.options.sql, next);
        },
        function getGeoJSON(err, previous) {
            assert.ifError(err);

            var BUFFER_SIZE = 16;

            if (typeof self.options['buffer-size'] === 'number'){
                BUFFER_SIZE = self.options['buffer-size'];
            }

            var query = self._composeGeojsonQuery(_.extend(geoJSONQueryContext, {
                columns: (Array.isArray(previous.columnNames) ? previous.columnNames.join(',') : null),
                bufferSize: BUFFER_SIZE
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

GeojsonRenderer.prototype._getQueryColumnNames = function (cartoPSQL, sql, callback) {

    var query = queryUtils.getColumnNamesFromQuery(sql);

    this._measureSQLQuery(cartoPSQL, query, 'columns', function (err, result) {
        if (err) {
            return callback(err);
        }
        callback(null, {
            columnNames: _(result.data.fields).chain()
                .filter(function (field) {
                    return field.name !== 'the_geom' && field.name !== 'the_geom_webmercator';
                }).pluck('name')
                .value(),
            stats: result.stats
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
