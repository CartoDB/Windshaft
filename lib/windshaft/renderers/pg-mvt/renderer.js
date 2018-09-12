const debug = require('debug')('windshaft:renderer:pg_mvt');
const PSQL = require('cartodb-psql');
const SubstitutionTokens = require('../../utils/substitution_tokens');
const Timer = require('../../stats/timer');

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

function setDefaultTokens (sql) {
    return SubstitutionTokens.replace(sql, {
        bbox: `CDB_XYZ_Extent(0,0,0)`,
        scale_denominator: `0`,
        pixel_width: `0`,
        pixel_height: `0`
    });
}

/**
 * Helper function to populate `layer._mvtColumns` with the columns to be
 * requested in the MVT tile SQL query
 * @param {Object} psql - Initialize cartodb-psql with the DB connection
 * @param {Object} layer - Map layers
 * @returns {Promise}
 */
function getLayerColumns(psql, layer) {
    return new Promise((resolve, reject) => {
        if (layer._mvtColumns) {
            return resolve();
        }

        if (!layer.options.sql) {
            return reject("Missing sql for layer");
        }

        const layerSQL = setDefaultTokens(layer.options.sql, 0, 0, 0);
        const limitedQuery = `SELECT * FROM (${layerSQL}) __windshaft_mvt_schema LIMIT 0;`;

        psql.query(limitedQuery, function (err, data) {
            if (err) {
                if (err.message) {
                    err.message = "PgMvtFactory: " + err.message;
                }
                return reject(err);
            }

            // We filter by type id to avoid the implicit casts that ST_AsMVT does
            // from any unknown type to string
            // These are the list of compatible type oids as declared in
            // mapnik/plugins/input/postgis/postgis_datasource.cpp
            const COMPATIBLE_MVT_TYPEIDS = [
                16,     // bool
                20,     // int8
                21,     // int2
                23,     // int4
                700,    // float4
                701,    // float8
                1700,   // numeric
                1042,   // bpchar
                1043,   // varchar
                25,     // text
                705,    // literal
            ];

            const metadataColumns = [];
            Object.keys(data.fields).forEach(function(key){
                const val = data.fields[key];
                if (COMPATIBLE_MVT_TYPEIDS.includes(val.dataTypeID)) {
                    metadataColumns.push(val.name);
                }
            });
            // We cache the column names to avoid requesting them again
            layer._mvtColumns = metadataColumns;
            return resolve();
        });
    });
}

/// CLASS: pg_mvt Renderer
//
/// A renderer for a given MapConfig layer
///
module.exports = class PostgresVectorRenderer {

    constructor (layers, options = {}, dbParams = {}) {
        this.layers = layers;
        this.dbParams = dbParams;
        this.dbPoolParams = options.dbPoolParams;
        this.psql = undefined;

        this.tile_size = 256;
        this.tile_max_geosize = 40075017; // earth circumference in webmercator 3857
        this.buffer_size = options.hasOwnProperty('bufferSize') ? options.bufferSize : 64; // Same as Mapnik::bufferSize
        this.vector_extent = options.vector_extent;
        this.vector_simplify_extent = options.vector_simplify_extent;
        this.subpixelBufferSize = Math.round(this.buffer_size * this.vector_extent / this.tile_size);
    }

    // Init DB and get layer column names.
    initDB (callback) {
        try {
            this.psql = new PSQL(this.dbParams, this.dbPoolParams);
        } catch (err) {
            return callback(err);
        }

        const columnNamePromises = this.layers.map(layer => getLayerColumns(this.psql, layer));
        Promise.all(columnNamePromises)
        .then(() => callback(null, this))
        .catch(err => callback(err));
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
            pixel_height: `cdb_XYZ_Resolution(${z})*${256 / this.tile_size}`
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
