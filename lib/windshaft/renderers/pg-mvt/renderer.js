const Timer = require('../../stats/timer');
const debug = require('debug')('windshaft:renderer:pg_mvt');
const SubstitutionTokens = require('../../utils/substitution_tokens');
const LayerColumns = require('../../utils/layer-columns');

const removeDuplicates = arr => [...new Set(arr)];

function shouldUseLayer(layer, zoom) {
    const minZoom = Number.isFinite(layer.options.minzoom) ? layer.options.minzoom : 0;
    const maxZoom = Number.isFinite(layer.options.maxzoom) ? layer.options.maxzoom : 30;
    return zoom >= minZoom && zoom <= maxZoom;
}

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
        const subqueries = this._getLayerQueries({ z, x, y });
        if (subqueries.length === 0) {
            return callback(new Error('Tile does not exist'));
        }

        const query = `SELECT ((${subqueries.join(') || (')})) AS st_asmvt`;
        const timer = new Timer();

        timer.start('query');
        this.psql.query(query, function (err, data) {
            timer.end('query');
            if (err) {
                debug("Error running pg-mvt query " + query + ": " + err);
                if (err.message) {
                    err.message = "PgMvtRenderer: " + err.message;
                }
                return callback(err);
            }

            const result = data.rows || [];

            if (result.length <= 0 || result[0].st_asmvt === undefined) {
                return callback(new Error(`Couldn't generate tile`));
            }

            const headers = { 'Content-Type': 'application/x-protobuf' };
            const stats = timer.getTimes();

            return callback(null, result[0].st_asmvt, headers, stats);
        });
    }

    _getLayerQueries({ z, x, y }) {
        return this.layers.reduce((queries, layer) => {
            if (shouldUseLayer(layer, z)) {
                const geomColumn = this._geomColumn({z, x, y});
                const columns = removeDuplicates(
                    [ geomColumn ].concat(LayerColumns.getColumns(layer.options))
                );
                const query = this._replaceTokens(layer.options.sql, {z, x, y});

                queries.push(this._vectorLayerQuery(layer.id, columns, query, { z, x, y }));
            }

            return queries;
        }, []);
    }

    _geomColumn ({ z, x, y }) {
        // Geometry column
        const subpixelBufferSize = Math.round(this.buffer_size * this.mvt_extent / this.tile_size);
        return `ST_AsMVTGeom(
            the_geom_webmercator,
            CDB_XYZ_Extent(${x},${y},${z}),
            ${this.mvt_extent},
            ${subpixelBufferSize},
            true
        )`;
    }

    _replaceTokens (sql, { z, x, y }) {
        return SubstitutionTokens.replace(sql, {
            bbox: `CDB_XYZ_Extent(${x},${y},${z})`,
            // See https://github.com/mapnik/mapnik/wiki/ScaleAndPpi#scale-denominator
            scale_denominator: `(cdb_XYZ_Resolution(${z})::numeric *${256 / this.tile_size / 0.00028})`,
            pixel_width: `cdb_XYZ_Resolution(${z})*${256 / this.tile_size}`,
            pixel_height: `cdb_XYZ_Resolution(${z})*${256 / this.tile_size}`,
            var_zoom: z,
            var_x: x,
            var_y: y
        });
    }

    _vectorLayerQuery (layerId, columns, query, { z, x, y }) {
        return `
            SELECT ST_AsMVT(geom, '${layerId}')
            FROM (
                SELECT ${columns.join(',')}
                FROM (${query}) AS cdbq
                WHERE
                    the_geom_webmercator &&
                    ST_Expand(
                        CDB_XYZ_Extent(${x},${y},${z}),
                        CDB_XYZ_Resolution(${z}) * ${Math.round(256 * this.buffer_size / this.tile_size)}
                    )
            ) AS geom
        `;
    }
};
