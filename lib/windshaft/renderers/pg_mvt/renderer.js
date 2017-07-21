var format = require('../../utils/format');
var Timer = require('../../stats/timer');
var debug = require('debug')('windshaft:renderer:pg_mvt');
var SubstitutionTokens = require('../../utils/substitution_tokens');

/// CLASS: pg_mvt Renderer
//
/// A renderer for a given MapConfig layer
///
function Renderer(layer, sql, attrs, options) {
    options = options || {};

    this.sql = sql;
    this.attrs = attrs;
    this.layer = layer;

    this.tile_size = options.tileSize || 256;
    this.tile_max_geosize = options.maxGeosize || 40075017; // earth circumference in webmercator 3857
    this.buffer_size = options.bufferSize || 0;
    this.mvt_extent = options.mvt_extent || 4096;
}

module.exports = Renderer;


Renderer.prototype = {
    /// API: renders a tile with the Renderer configuration
    /// @param x tile x coordinate
    /// @param y tile y coordinate
    /// @param z tile zoom
    /// callback: will be called when done using nodejs protocol (err, data)
    getTile: function(z, x, y, callback) {
        this.getTileData(this.sql, {x: x, y: y}, z, this.layer.options.sql, this.attrs, callback);
    },

    /// API: returns metadata for this renderer
    /// TODO anything useful here?
    ///
    getMetadata: function(callback) {
        var meta = {};
        callback(null, meta);
    },

    getTileData: function(sql, coord, zoom, layer_sql, attrs, callback) {

        var tile_size = this.tile_size;
        var buffer_size = this.buffer_size;
        var tile_max_geosize = this.tile_max_geosize;
        // TODO consider the_geom instead
        var geom_column = this.layer.options.geom_column || 'the_geom_webmercator';
        var geom_column_srid = this.layer.options.srid || 3857;

        function cdb_XYZ_Resolution(z) {
            var full_resolution = tile_max_geosize / tile_size;
            return full_resolution / Math.pow(2, z);
        }

        function cdb_XYZ_Extent(x, y, z) {
            var initial_resolution = cdb_XYZ_Resolution(0);
            var origin_shift = (initial_resolution * tile_size) / 2.0;

            var pixres = initial_resolution / Math.pow(2,z);
            var tile_geo_size = tile_size * pixres;

            var buffer = buffer_size / 2;

            var xmin = -origin_shift + x*tile_geo_size;
            var xmax = -origin_shift + (x+1)*tile_geo_size;

            // tile coordinate system is y-reversed so ymin is the top of the tile
            var ymin = origin_shift - y*tile_geo_size;
            var ymax = origin_shift - (y+1)*tile_geo_size;
            return {
                xmin: xmin,
                ymin: ymin,
                xmax: xmax,
                ymax: ymax,
                b_xmin: xmin - (pixres * buffer),
                b_ymin: ymin + (pixres * buffer),
                b_xmax: xmax + (pixres * buffer),
                b_ymax: ymax - (pixres * buffer),
                b_size: buffer / attrs.resolution
            };
        }

        var tile_sql =
            "SELECT ST_AsMVT('{layer_id}', {mvt_extent}, 'geom', q) FROM " +
            "(SELECT cartodb_id, count_vals, " + // attributes here
            "ST_AsMVTGeom(" +
            "qbounds.the_geom_webmercator, " + // geometry
            "ST_MakeBox2D(ST_Point({xmin}, {ymin}), ST_Point({xmax}, {ymax}))" + // bounds
            ", {mvt_extent}" + // extent
            ", 0" + // buffer
            ",false" + // clip geom
            ") AS geom FROM (SELECT * FROM ({_sql}) as cdbq WHERE \"the_geom_webmercator\" && ST_MakeEnvelope({b_xmin}, {b_ymin}, {b_xmax}, {b_ymax}, {srid})) as qbounds) AS q";

        var extent = cdb_XYZ_Extent(coord.x, coord.y, zoom);
        var xyz_resolution = cdb_XYZ_Resolution(zoom);

        layer_sql = SubstitutionTokens.replace(layer_sql, {
            bbox: format('ST_MakeEnvelope({xmin},{ymin},{xmax},{ymax},{srid})', { srid: geom_column_srid }, extent),
            // See https://github.com/mapnik/mapnik/wiki/ScaleAndPpi#scale-denominator
            scale_denominator: xyz_resolution / 0.00028,
            pixel_width: xyz_resolution,
            pixel_height: xyz_resolution,
            var_zoom: zoom,
            var_bbox: format('[{b_xmin}, {b_ymin}, {b_xmax}, {b_ymax}]', extent),
            var_x: coord.x,
            var_y: coord.y
        });

        var query = format(tile_sql, {_sql: layer_sql}, attrs, {
            zoom: zoom,
            x: coord.x,
            y: coord.y,
            xyz_resolution: xyz_resolution,
            srid: geom_column_srid,
            gcol: geom_column,
            layer_id: this.layer.id,
            mvt_extent: this.mvt_extent
        }, extent);

        var timer = new Timer();
        timer.start('query');
        sql(query, function (err, data) {
            timer.end('query');
            if (err) {
                debug("Error running pg_mvt query " + query + ": " + err);
                if ( err.message ) {
                    err.message = "PgMvtRenderer: " + err.message;
                }
                callback(err);
            } else {
                callback(null, data.rows[0].st_asmvt, {'Content-Type': 'application/x-protobuf'}, timer.getTimes());
            }
        });
    }
};
