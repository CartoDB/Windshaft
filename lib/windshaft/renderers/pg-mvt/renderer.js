const Timer = require('../../stats/timer');
const debug = require('debug')('windshaft:renderer:pg_mvt');
const SubstitutionTokens = require('../../utils/substitution_tokens');
const LayerColumns = require('../../utils/layer-columns');

const removeDuplicates = arr => [...new Set(arr)];

/// CLASS: pg_mvt Renderer
//
/// A renderer for a given MapConfig layer
///
module.exports = class PostgresVectorRenderer {
    constructor (layers, psql, attrs, options) {
        options = options || {};

        this.psql = psql;
        this.attrs = attrs;
        this.layers = layers;

        this.tile_size = options.tileSize || 256;
        this.tile_max_geosize = options.maxGeosize || 40075017; // earth circumference in webmercator 3857
        this.buffer_size = options.bufferSize || 0;
        this.mvt_extent = options.mvt_extent || 4096;
    }

    /// API: renders a tile with the Renderer configuration
    /// @param x tile x coordinate
    /// @param y tile y coordinate
    /// @param z tile zoom
    /// callback: will be called when done using nodejs protocol (err, data)
    getTile (z, x, y, callback) {
        const subqueries = this.getLayerQueries(z, x, y);
        const query = `SELECT (${subqueries.join(' || ')}) AS st_asmvt`;
        const timer = new Timer();

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

    getLayerQueries(z, x, y) {
        return this.layers.map(layer => {
            // Geometry column
            const subpixelBufferSize = Math.round(this.buffer_size * this.mvt_extent / this.tile_size);
            const geomColumn = `ST_AsMVTGeom(
                the_geom_webmercator, CDB_XYZ_Extent(${x},${y},${z}), ${this.mvt_extent}, ${subpixelBufferSize}, true
            )`;

            let columns = [ geomColumn ];

            if (Array.isArray(layer.options.columns)) {
                columns = columns.concat(layer.options.columns);
            } else {
                columns = columns.concat(LayerColumns.getColumns(layer.options));
            }

            columns = removeDuplicates(columns);

            const subQuery = SubstitutionTokens.replace(layer.options.sql, {
                bbox: `CDB_XYZ_Extent(${x},${y},${z})`,
                // See https://github.com/mapnik/mapnik/wiki/ScaleAndPpi#scale-denominator
                scale_denominator: `(cdb_XYZ_Resolution(${z})::numeric *${256 / this.tile_size / 0.00028})`,
                pixel_width: `cdb_XYZ_Resolution(${z})*${256 / this.tile_size}`,
                pixel_height: `cdb_XYZ_Resolution(${z})*${256 / this.tile_size}`,
                var_zoom: z,
                var_x: x,
                var_y: y
            });

            return `(select st_asmvt(geom, '${layer.id}') FROM (
                SELECT ${columns.join(',')}
                FROM (${subQuery}) AS cdbq
                WHERE the_geom_webmercator && ST_Expand(CDB_XYZ_Extent(${x},${y},${z}),
                    cdb_XYZ_Resolution(${z})*${Math.round(256 * this.buffer_size / this.tile_size)})
                )AS geom
            )`;
        });
    }
};
