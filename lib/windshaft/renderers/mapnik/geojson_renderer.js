var Timer = require('../../stats/timer');
var debug = require('debug')('windshaft:renderer:torque');
var GeojsonSqlWrapper = require('./geojson_sql_wrapper');

function GeojsonRenderer(cartoPSQL, layer) {
    this.cartoPSQL = cartoPSQL;
    this.layer = layer;
}

module.exports = GeojsonRenderer;

GeojsonRenderer.prototype = {
    /// API: renders a tile with the GeojsonRenderer configuration
    /// @param x tile x coordinate
    /// @param y tile y coordinate
    /// @param z tile zoom
    /// callback: will be called when done using nodejs protocol (err, data)
    getTile: function(z, x, y, callback) {
        this.getTileData(this.cartoPSQL, {x: x, y: y}, z, this.layer.options.sql, callback);
    },

    getTileData: function(cartoPSQL, coord, zoom, layer_sql, callback) {
        var query = this._composeGeojsonQuery({
            coord: coord,
            zoom: zoom,
            layerSql: layer_sql,
            geomColumn: this.layer.options.geom_column || 'the_geom_webmercator',
        });

        this._measureSQLQuery(cartoPSQL, query, function (err, data, stats) {
            if (err) {
                debug("Error running geojson query " + query + ": " + err);
                return callback(err);
            }

            // FIXME: response's header shouldn't be here. it must be at server level
            callback(null, data, {'Content-Type': 'application/json'}, stats);
        });
    },

    _composeGeojsonQuery: function  (queryContext) {
      return new GeojsonSqlWrapper().wrap(queryContext);
    },

    _formatSQLData: function (data) {
        if (data && data.rows && data.rows[0] && data.rows[0].geojson && !data.rows[0].geojson.features) {
            return {};
        }

        return data.rows[0].geojson;
    },

    _measureSQLQuery: function (cartoPSQL, query, callback) {
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
    }
};
