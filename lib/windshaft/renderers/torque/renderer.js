var format = require('../../utils/format');

/// CLASS: torque Renderer
//
/// A renderer for a given MapConfig layer
///
function Renderer(layer, sql, attrs) {
    this.sql = sql;
    this.attrs = attrs;
    this.layer_sql = layer.options.sql;
    //TODO: take defaults as parameters
    this.tile_size = 256;
    this.tile_max_geosize = 40075017; // earth circumference in webmercator 3857
    this.geom_column = layer.options.geom_column || 'the_geom_webmercator';
    this.geom_column_srid = layer.options.srid || 3857;
}

module.exports = Renderer;


Renderer.prototype = {
    /// API: renders a tile with the Renderer configuration
    /// @param x tile x coordinate
    /// @param y tile y coordinate
    /// @param z tile zoom
    /// callback: will be called when done using nodejs protocol (err, data)
    getTile: function(z, x, y, callback) {
        this.getTileData(this.sql, {x: x, y: y}, z, this.layer_sql, this.attrs, callback);
    },

    /// API: returns metadata for this renderer
    //
    /// Metadata for a torque layer is an object
    /// with the following elements:
    ///   - start  ??
    ///   - end    ??
    ///   - data_steps ??
    ///   - column_type ??
    ///
    /// TODO: document the meaning of each !
    ///
    getMetadata: function(callback) {
        var a = this.attrs;
        var meta = {
            start: a.start * 1000,
            end: a.end * 1000,
            data_steps: a.data_steps >> 0,
            column_type: a.is_time ? 'date': 'number'
        };
        callback(null, meta);
    },

    getTileData: function(sql, coord, zoom, layer_sql, attrs, callback) {

        var column_conv = attrs.column;

        if(attrs.is_time) {
            column_conv = format("date_part('epoch', {column})", attrs);
        }

        var tile_size = this.tile_size;
        var tile_max_geosize = this.tile_max_geosize;
        var geom_column = this.geom_column;
        var geom_column_srid = this.geom_column_srid;

        function CDB_XYZ_Resolution(z) {
            var full_resolution = tile_max_geosize / tile_size;
            return full_resolution / Math.pow(2, z);
        }

        function CDB_XYZ_Extent(x, y, z) {
            var initial_resolution = CDB_XYZ_Resolution(0);
            var origin_shift = (initial_resolution * tile_size) / 2.0;

            var pixres = initial_resolution / Math.pow(2,z);
            var tile_geo_size = tile_size * pixres;

            var xmin = -origin_shift + x*tile_geo_size;
            var xmax = -origin_shift + (x+1)*tile_geo_size;

            // tile coordinate system is y-reversed so ymin is the top of the tile
            var ymin = origin_shift - y*tile_geo_size;
            var ymax = origin_shift - (y+1)*tile_geo_size;
            return {
                xmin: xmin, ymin: ymin, xmax: xmax, ymax: ymax
            };
        }

        var tile_sql = "" +
            "WITH par AS (" +
            "WITH innerpar AS (" +
            "SELECT " +
            "1.0/(({xyz_resolution})*{resolution}) as resinv, " +
            "ST_MakeEnvelope({xmin}, {ymin}, {xmax}, {ymax}, {srid}) as ext" +
            ") " +
            "SELECT " +
            "({xyz_resolution})*{resolution} as res, " +
            "innerpar.resinv as resinv, " +
            "innerpar.ext as ext, " +
            "st_xmin(innerpar.ext) as xmin, " +
            "st_ymin(innerpar.ext) as ymin, " +
            "round((st_xmax(innerpar.ext) - st_xmin(innerpar.ext))*innerpar.resinv) - 1 as maxx, " +
            "round((st_ymax(innerpar.ext) - st_ymin(innerpar.ext))*innerpar.resinv) - 1 as maxy " +
            "FROM innerpar" +
            ") " +
            "SELECT xx x__uint8, " +
            "yy y__uint8, " +
            "array_agg(c) vals__uint8, " +
            "array_agg(d) dates__uint16 " +
            "FROM ( " +
            "select " +
            "GREATEST(0, LEAST(p.maxx, round((st_x(i.{gcol}) - p.xmin)*resinv))) as xx, " +
            "GREATEST(0, LEAST(p.maxy, round((st_y(i.{gcol}) - p.ymin)*resinv))) as yy " +
            ", {countby} c " +
            ", floor(({column_conv} - {start})/{step}) d " +
            "FROM ({_sql}) i, par p " +
            // We expand the extent by half the resolution
            // to include points that would fall within the
            // extent on grid snapping
            "WHERE i.{gcol} && p.ext " +
            "GROUP BY xx, yy, d  " +
            ") cte, par  " +
            "GROUP BY x__uint8, y__uint8; ";

        var query = format(tile_sql, attrs, {
            zoom: zoom,
            x: coord.x,
            y: coord.y,
            column_conv: column_conv,
            _sql: layer_sql,
            xyz_resolution: CDB_XYZ_Resolution(zoom),
            srid: geom_column_srid,
            gcol: geom_column
        }, CDB_XYZ_Extent(coord.x, coord.y, zoom));

        sql(query, function (err, data) {
            if (err) {
                console.log("Error running torque query " + query + ": " + err);
                if ( err.message ) err.message = "TorqueRenderer: " + err.message;
                callback(err);
            }
            else callback(null, data.rows);
            //prof_fetch_time.end();
        });
    }
};