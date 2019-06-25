'use strict';

const debug = require('debug')('windshaft:renderer:pg_mvt');
const PSQL = require('cartodb-psql');
const SubstitutionTokens = require('../../utils/substitution_tokens');
const Timer = require('../../stats/timer');
const DefaultQueryRewriter = require('../../utils/default_query_rewriter');
const CartoDBPostgisUtils = require('../../utils/cartodb_postgis_utils');

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
        bbox: `ST_MakeEnvelope(-20037508.3427892, -20037508.3427892, 20037508.3427892, 20037508.3427892, 3857)`,
        scale_denominator: `0`,
        pixel_width: `0`,
        pixel_height: `0`
    });
}

function removeTrailingSemiColon(sql) {
    return sql.replace(/\s*;\s*$/, '');
}


function cancelQuery (query, dbParams, dbPoolParams, callback)
{
    let pg;
    try {
        pg = new PSQL(dbParams, dbPoolParams);
    } catch (err) { return callback(); }

    const getPIDQuery = "SELECT pid FROM pg_stat_activity WHERE query LIKE $cancelQuery$" + query + "$cancelQuery$";
    pg.query(getPIDQuery, (err, result) => {
        if (err) { pg.end(); return callback(); }

        if (!result.rows[0] || !result.rows[0].pid) {
            pg.end();
            return callback();
        }

        const pid = result.rows[0].pid;
        const cancelQuery = 'SELECT pg_cancel_backend(' + pid + ')';

        pg.query(cancelQuery, () => {
            pg.end();
            callback();
        });
    });
}

/**
 * Helper function to populate `layer._mvtColumns` with the columns to be
 * requested in the MVT tile SQL query
 * @param {Object} psql - Initialized cartodb-psql with the DB connection
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

        const layerSQL = setDefaultTokens(removeTrailingSemiColon(layer.options.sql), 0, 0, 0);
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
        this.renderLimit = options.limits ? options.limits.render || 0 : 0;

        this.tileSize = 256;
        this.tileMaxGeosize = 6378137 * Math.PI * 2; // earth circumference in webmercator 3857
        this.bufferSize = options.hasOwnProperty('bufferSize') ? options.bufferSize : 64; // Same as Mapnik::bufferSize
        this.vectorExtent = options.vector_extent;
        this.vectorSimplifyExtent = options.vector_simplify_extent;
        this.subpixelBufferSize = Math.round(this.bufferSize * this.vectorExtent / this.tileSize);
        this.queryRewriter = options.queryRewriter || new DefaultQueryRewriter();
        this.pgUtils = new CartoDBPostgisUtils(this.tileSize, this.tileMaxGeosize);

        // May throw
        this.psql = new PSQL(this.dbParams, this.dbPoolParams);
    }

    // Retrieve the columns of all layers for later usage when requesting tiles
    getAllLayerColumns (callback) {
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
        const subqueries = this._getLayerQueries({ z, x, y });
        if (subqueries.length === 0) {
            return callback(null, new Buffer(0), { 'Content-Type': 'application/x-protobuf',
                                                   'x-tilelive-contains-data' : false });
        }

        const query = `SELECT ((${subqueries.join(') || (')})) AS st_asmvt`;
        const promises = [this._getTilePromise(query)];

        // Matching tilelive-bridge timeout-decorator.js string
        const TIMEOUT_ERROR_MSG = 'Render timed out';
        if (this.renderLimit) {
            promises.push(new Promise((resolve, reject) =>
                setTimeout(reject, this.renderLimit, new Error(TIMEOUT_ERROR_MSG))
            ));
        }

        Promise.race(promises)
        .then(([mvt, headers, stats]) => callback(null, mvt, headers, stats))
        .catch(err => {
            if (err.message === TIMEOUT_ERROR_MSG) {
                return cancelQuery(query, this.dbParams, this.dbPoolParams, () => callback(err));
            } else {
                return callback(err);
            }
        });
    }

    _getLayerQueries({ z, x, y }) {
        return this.layers
            .filter(layer => shouldUseLayer(layer, z))
            .map(layer => {
                const geomColumn = this._geomColumn(layer, z);
                return this._vectorLayerQuery(layer, geomColumn, layer._mvtColumns, layer.options.sql, { z, x, y });
            });
    }

    _geomColumn (layer, z) {
        let geomColumn = layer.options.geom_column || 'the_geom_webmercator';
        if (this.vectorExtent !== this.vectorSimplifyExtent) {
            const tol = (this.tileMaxGeosize / Math.pow(2, z)) / (this.vectorSimplifyExtent * 2);
            geomColumn = `ST_Simplify(ST_RemoveRepeatedPoints(${geomColumn}, ${tol}), ${tol}, true)`;
        }
        return `ST_AsMVTGeom(
                    ${geomColumn},
                    !tile_bbox!,
                    ${this.vectorExtent},
                    ${this.subpixelBufferSize},
                    true
                ) as the_geom_webmercator`;
    }

    _replaceTokens (sql, { z = 0, x = 0, y = 0 }) {
        const resolution = this.pgUtils.cdbXYZResolution(z);
        const extent = this.pgUtils.cdbXYZExtent(x, y, z);

        return SubstitutionTokens.replace(sql, {
            bbox: `ST_Expand(!tile_bbox!, ${resolution * this.bufferSize})`,
            // See https://github.com/mapnik/mapnik/wiki/ScaleAndPpi#scale-denominator
            scale_denominator: `${resolution / 0.00028}`,
            pixel_width: `${resolution}`,
            pixel_height: `${resolution}`,
            tile_bbox : `ST_MakeEnvelope(${extent.xmin}, ${extent.ymin}, ${extent.xmax}, ${extent.ymax}, 3857)`
        });
    }

    _vectorLayerQuery (layer, geometryColumn, columns, query, { z, x, y }) {
        const layerId = layer.id;
        const geomColumn = layer.options.geom_column || 'the_geom_webmercator';
        const columnList = Array.isArray(columns) && columns.length > 0 ? `, "${columns.join('", "')}"` : '';
        const queryRewriteData = layer.options && layer.options.query_rewrite_data ?
            layer.options.query_rewrite_data :
            undefined;

        query = this.queryRewriter.query(removeTrailingSemiColon(query), queryRewriteData);

        return this._replaceTokens(
                `SELECT ST_AsMVT(geometries, '${layerId}', ${this.vectorExtent}, 'the_geom_webmercator')
                FROM (
                    SELECT ${geometryColumn}${columnList}
                    FROM (${query}) AS cdbq
                    WHERE ${geomColumn} && !bbox!
                ) AS geometries
                `, { z, x, y });
    }

    _getTilePromise (query) {
        return new Promise((resolve, reject) => {
            const timer = new Timer();
            timer.start('query');

            this.psql.query(query, function (err, data) {
                timer.end('query');
                if (err) {
                    debug("Error running pg-mvt query " + query + ": " + err);
                    if (err.message) {
                        err.message = "PgMvtRenderer: " + err.message;
                    }
                    return reject(err);
                }

                const mvt = extractMVT(data);
                const headers = { 'Content-Type': 'application/x-protobuf' };
                headers['x-tilelive-contains-data'] = mvt !== null;

                const stats = timer.getTimes();

                return resolve([mvt || new Buffer.alloc(0), headers, stats]);
            });
        });
    }
};
