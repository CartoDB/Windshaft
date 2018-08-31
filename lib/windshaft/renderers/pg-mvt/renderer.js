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

    constructor (layers, psql, attrs, options = {}) {
        this.psql = psql;
        this.attrs = attrs;
        this.layers = layers;

        this.tile_size = 256;
        this.tile_max_geosize = 40075017; // earth circumference in webmercator 3857
        this.buffer_size = options.hasOwnProperty('bufferSize') ? options.bufferSize : 64; // Same as Mapnik::bufferSize
        this.vector_extent = options.vector_extent;
        this.vector_simplify_extent = options.vector_simplify_extent;
        this.subpixelBufferSize = Math.round(this.buffer_size * this.vector_extent / this.tile_size);
    }

    /// API: renders a tile with the Renderer configuration
    /// @param x tile x coordinate
    /// @param y tile y coordinate
    /// @param z tile zoom
    /// callback: will be called when done using nodejs protocol (err, data)
    getTile (z, x, y, callback) {
        const headers = {
            'Content-Type': 'application/x-protobuf',
            'x-tilelive-contains-data' : false
        };

        const subqueries = this._getLayerQueries({ z, x, y });
        if (subqueries.length === 0) {
            return callback(null, new Buffer(0), headers);
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
            if (mvt) {
                headers['x-tilelive-contains-data'] = true;
            }
            const stats = timer.getTimes();

            return callback(null, mvt || new Buffer(0), headers, stats);
        });
    }

    _getLayerQueries({ z, x, y }) {
        return this.layers
                          .filter(layer => shouldUseLayer(layer, z))
                          .map(layer => {
            const geomColumn = this._geomColumn(layer, { z, x, y });
            return this._vectorLayerQuery(layer, geomColumn, layer._mvtColumns, layer.options.sql, { z, x, y });
        });
    }

    _geomColumn (layer, { z = 0, x = 0, y = 0 }) {
        let geomColumn = layer.options.geom_column || 'the_geom_webmercator';
        if (this.vector_extent !== this.vector_simplify_extent) {
            const tol = (this.tile_max_geosize / Math.pow(2, z)) / (this.vector_simplify_extent * 2);
            geomColumn = `ST_Simplify(ST_RemoveRepeatedPoints(${geomColumn}, ${tol}), ${tol}, true)`;
        }
        return `ST_AsMVTGeom(
                    ${geomColumn},
                    CDB_XYZ_Extent(${x},${y},${z}),
                    ${this.vector_extent},
                    ${this.subpixelBufferSize},
                    true
                ) as the_geom_webmercator`;
    }

    _replaceTokens (sql, { z = 0, x = 0, y = 0 }) {
        return SubstitutionTokens.replace(sql, {
            bbox: `ST_Expand(
                            CDB_XYZ_Extent(${x},${y},${z}),
                            CDB_XYZ_Resolution(${z}) * ${Math.round(256 * this.buffer_size / this.tile_size)}
                        )`,
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

        return this._replaceTokens(
                `SELECT ST_AsMVT(geometries, '${layerId}', ${this.vector_extent}, 'the_geom_webmercator')
                FROM (
                    SELECT ${geometryColumn}${columnList}
                    FROM (${query}) AS cdbq
                    WHERE ${geomColumn} && !bbox!
                ) AS geometries
                `, { z, x, y });
    }
};
