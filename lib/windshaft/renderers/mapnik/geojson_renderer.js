var Timer = require('../../stats/timer');
var debug = require('debug')('windshaft:renderer:torque');
var GeojsonSqlWrapper = require('./geojson_sql_wrapper');
var queue = require('queue-async');
var _ = require('underscore');

function GeojsonRenderer(cartoPSQL, layers) {
    this.cartoPSQL = cartoPSQL;
    this.layers = layers;
}

module.exports = GeojsonRenderer;

/// API: renders a tile with the GeojsonRenderer configuration
/// @param x tile x coordinate
/// @param y tile y coordinate
/// @param z tile zoom
/// callback: will be called when done using nodejs protocol (err, data)
GeojsonRenderer.prototype.getTile = function(z, x, y, callback) {
    var self = this;
        
    var timer = new Timer();
    timer.start('render');

    var rendererGetTileQueue = queue(this.layers.length);
    
    this.layers.forEach(function(layer) {
        if (layer.type === 'mapnik') {
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
            r: _.pluck(result, 'stats')
        });
                
        var geoJsonTiles = self._formatTileResponse(result);
        
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
    var query = this._composeGeojsonQuery({
        coord: coord,
        zoom: zoom,
        layerSql: layer.options.sql,
        geomColumn: layer.options.geom_column || 'the_geom_webmercator',
        columns: layer.options.attributes ? layer.options.attributes.columns : null
    });

    this._measureSQLQuery(cartoPSQL, query, function (err, data, stats) {
        if (err) {
            debug("Error running geojson query " + query + ": " + err);
            return callback(err);
        }

        // FIXME: response's header shouldn't be here. it must be at server level
        callback(null, {
            data: data,
            stats: stats
        });
    });
};

GeojsonRenderer.prototype._composeGeojsonQuery = function  (queryContext) {
    return new GeojsonSqlWrapper().wrap(queryContext);
};

GeojsonRenderer.prototype._measureSQLQuery = function (cartoPSQL, query, callback) {
    var self = this;
    var timer = new Timer();

    timer.start('query');
    cartoPSQL.query(query, function (err, data) {
        timer.end('query');
        if (err) {
            return callback(err);
        }

        callback(null, self._formatSQLData(data), timer.getTimes());
    }, true);
};

GeojsonRenderer.prototype._formatSQLData = function (data) {
    if (data && data.rows && data.rows[0] && data.rows[0].geojson && !data.rows[0].geojson.features) {
        data.rows[0].geojson.features = [];
    }

    return data.rows[0].geojson;
};
