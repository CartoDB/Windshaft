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
        var that = this;

        this.getMetadata(function (err, meta) {
            if (err) {
                callback(err);
            } else {
                that.getTileData(that.sql, {x: x, y: y}, z, that.layer.options.sql, that.attrs, callback);
            }
        });
    },

    /// API: returns metadata for this renderer
    /// callback: will be called when done using nodejs protocol (err, data)
    getMetadata: function(callback) {
        // TODO I don't really like how this ended up, this is to be moved to a "static" method, then used by the factory instead
        if(this.metadata === undefined) {
            var that = this;
            var layer_sql = this.layer.options.sql + ' LIMIT 0';
            var layer_query = SubstitutionTokens.replace(layer_sql, {
                // arbitrary bbox, scale, etc. to get the fields returned by the layer query
                bbox: 'ST_MakeEnvelope(-20037508.3,-20037508.3,20037508.3,20037508.3, 3857)',
                scale_denominator: 156543.033928041 / 0.00028,
                pixel_width: 156543.033928041,
                pixel_height: 156543.033928041,
                var_zoom: 0,
                var_bbox: '[-20037508.3,-20037508.3,20037508.3,20037508.3]',
                var_x: 0,
                var_y: 0
            });

            this.sql(layer_query, function (err, data) {
                if (err) {
                    debug("Error running pg_mvt query " + query + ": " + err);
                    if ( err.message ) {
                        err.message = "PgMvtRenderer: " + err.message;
                    }
                    callback(err);
                } else {
                    that.metadata = {
                        fields: data.fields
                    }
                    console.log(that.metadata);
                    callback(null, that.metadata);
                }
            });
        } else {
            callback(null, this.metadata);
        }
    },

    getTileData: function(sql, coord, zoom, layer_sql, attrs, callback) {

        var tile_size = this.tile_size;
        var buffer_size = this.buffer_size;
        var tile_max_geosize = this.tile_max_geosize;
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
            "(SELECT {attributes}, " +
            "ST_AsMVTGeom(" +
            "qbounds.the_geom_webmercator, " + // geometry
            "ST_MakeBox2D(ST_Point({xmin}, {ymin}), ST_Point({xmax}, {ymax}))" + // bounds
            ", {mvt_extent}" + // extent
            ", 0" + // buffer
            ",false" + // clip geom
            ") AS geom FROM (SELECT * FROM ({_sql}) as cdbq WHERE \"the_geom_webmercator\" && ST_MakeEnvelope({b_xmin}, {b_ymin}, {b_xmax}, {b_ymax}, {srid}) LIMIT 65536) as qbounds) AS q";

        var extent = cdb_XYZ_Extent(coord.x, coord.y, zoom);
        var xyz_resolution = cdb_XYZ_Resolution(zoom);
        var non_geo_fields = Object.keys(this.metadata.fields).filter(function (field) {
            return field !== geom_column && field !== 'the_geom' && field !== 'the_geom_webmercator';
        });

        var layer_query = SubstitutionTokens.replace(layer_sql, {
            bbox: format('ST_MakeEnvelope({xmin},{ymin},{xmax},{ymax},{srid})', { srid: geom_column_srid }, extent),
            // See https://github.com/mapnik/mapnik/wiki/ScaleAndPpi#scale-denominator
            scale_denominator: xyz_resolution / 0.00028,
            pixel_width: xyz_resolution,
            pixel_height: xyz_resolution,
            var_zoom: zoom,
            /*
             * TODO note that below b_ymin and b_ymax are swapped.
             * There's an inconsistency about how the bounding box is defined in TTDatasource vs torque.
             * See the comment about ymin and ymax calculation above.
             */
            var_bbox: format('[{b_xmin}, {b_ymax}, {b_xmax}, {b_ymin}]', extent),
            var_x: coord.x,
            var_y: coord.y
        });

        var query = format(tile_sql, {_sql: layer_query}, attrs, {
            zoom: zoom,
            x: coord.x,
            y: coord.y,
            xyz_resolution: xyz_resolution,
            srid: geom_column_srid,
            gcol: geom_column,
            layer_id: this.layer.id,
            attributes: non_geo_fields.join(','),
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
