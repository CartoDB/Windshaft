var Timer = require('../../stats/timer');
var debug = require('debug')('windshaft:renderer:pg_mvt');
var SubstitutionTokens = require('../../utils/substitution_tokens');
var geojsonUtils = require('../../utils/geojson_utils');

/// CLASS: pg_mvt Renderer
//
/// A renderer for a given MapConfig layer
///
function Renderer(layers, psql, attrs, options) {
    options = options || {};

    this.psql = psql;
    this.attrs = attrs;
    this.layers = layers;

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
    getTile: function (z, x, y, callback) {
        const subqueries = this.layers.map(layer => {

            // Geometry column
            const pixelsBufferSize = Math.round(this.buffer_size * this.mvt_extent / this.tile_size);
            const geomColumn = `ST_AsMVTGeom(
                the_geom_webmercator, CDB_XYZ_Extent(${x},${y},${z}), ${this.mvt_extent}, ${pixelsBufferSize}, true
            )`;

            var columns = [geomColumn].concat(geojsonUtils.getGeojsonProperties(layer.options));

            console.log("COLUMNS", columns);

            var subQuery = SubstitutionTokens.replace(layer.options.sql, {
                bbox: `CDB_XYZ_Extent(${x},${y},${z})`,
                // See https://github.com/mapnik/mapnik/wiki/ScaleAndPpi#scale-denominator
                scale_denominator: `(cdb_XYZ_Resolution(${z}) / 0.00028)`,
                pixel_width: `cdb_XYZ_Resolution(${z})`,
                pixel_height: `cdb_XYZ_Resolution(${z})`,
                var_zoom: z,
                var_x: x,
                var_y: y
            });

            return `(select st_asmvt(geom, '${layer.id}') FROM (
                SELECT ${columns.join(',')}
                FROM (${subQuery}) AS cdbq
                WHERE the_geom_webmercator && CDB_XYZ_Extent(${x},${y},${z}))
                AS geom
            )`;
        });
        var query = `SELECT (${subqueries.join(' || ')}) AS st_asmvt`;

        var timer = new Timer();
        timer.start('query');
        this.psql.query(query, function (err, data) {
            timer.end('query');
            if (err) {
                debug("Error running pg-mvt query " + query + ": " + err);
                if (err.message) {
                    err.message = "PgMvtRenderer: " + err.message;
                }
                callback(err);
            } else {
                if (data.rows.length <= 0 || data.rows[0].st_asmvt === undefined) {
                    return callback(new Error(`Couldn't generate tile`));
                }
                callback(null, data.rows[0].st_asmvt, { 'Content-Type': 'application/x-protobuf' }, timer.getTimes());
            }
        });
    }
};
