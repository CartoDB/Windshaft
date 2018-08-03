const Timer = require('../../stats/timer');
const debug = require('debug')('windshaft:renderer:pg_mvt');
const SubstitutionTokens = require('../../utils/substitution_tokens');

function shouldUseLayer(layer, zoom) {
    const minZoom = Number.isFinite(layer.options.minzoom) ? layer.options.minzoom : 0;
    const maxZoom = Number.isFinite(layer.options.maxzoom) ? layer.options.maxzoom : 30;
    return zoom >= minZoom && zoom <= maxZoom;
}

function extractMVT(data) {
    if (data &&
        data.rows &&
        data.rows.length > 0 &&
        data.rows[0].st_asmvt &&
        data.rows[0].st_asmvt.length > 0) {
        return data.rows[0].st_asmvt;
    }

    return null;
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
        this.buffer_size = options.bufferSize || 64; // Same as Mapnik::bufferSize
        this.mvt_extent = options.mvt_extent || 4096;
        this.subpixelBufferSize = Math.round(this.buffer_size * this.mvt_extent / this.tile_size);
    }

    /// API: renders a tile with the Renderer configuration
    /// @param x tile x coordinate
    /// @param y tile y coordinate
    /// @param z tile zoom
    /// callback: will be called when done using nodejs protocol (err, data)
    getTile (z, x, y, callback) {
        const subqueries = this._getLayerQueries({ z, x, y });

        if (subqueries.length === 0) {
            return callback(null, new Buffer(0));
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

            const mvt = extractMVT(data);
            const headers = {
                'Content-Type': 'application/x-protobuf',
                'x-tilelive-contains-data' : mvt ? true : false
            };
            const stats = timer.getTimes();

            return callback(null, mvt || new Buffer(0), headers, stats);
        });
    }

    _getLayerQueries({ z, x, y }) {
        return this.layers
                          .filter(layer => shouldUseLayer(layer, z))
                          .map(layer => {
            const geomColumn = this._geomColumn(layer, { z, x, y });
            const query = this._replaceTokens(layer.options.sql, { z, x, y });
            return this._vectorLayerQuery(layer, geomColumn, layer._mvtColumns, query, { z, x, y });
        });
    }

    _geomColumn (layer, { z, x, y }) {
        const geomColumn = layer.options.geom_column || 'the_geom_webmercator';
        return `ST_AsMVTGeom(
                    ${geomColumn},
                    CDB_XYZ_Extent(${x},${y},${z}),
                    ${this.mvt_extent},
                    ${this.subpixelBufferSize},
                    true
                ) as the_geom_webmercator`;
    }

    _replaceTokens (sql, { z = 0, x = 0, y = 0 }) {
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

    _vectorLayerQuery (layer, geometryColumn, columns, query, { z, x, y }) {
        const layerId = layer.id;
        const geomColumn = layer.options.geom_column || 'the_geom_webmercator';
        const columnList = !columns ? '' : `, "${columns.join('", "')}"`;

        return `SELECT ST_AsMVT(geom, '${layerId}')
                FROM (
                    SELECT ${geometryColumn}${columnList}
                    FROM (${query}) AS cdbq
                    WHERE
                        ${geomColumn} &&
                        ST_Expand(
                            CDB_XYZ_Extent(${x},${y},${z}),
                            CDB_XYZ_Resolution(${z}) * ${Math.round(256 * this.buffer_size / this.tile_size)}
                        )
                ) AS geom
        `;
    }
};
