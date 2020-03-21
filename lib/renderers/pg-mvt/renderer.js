'use strict';

const debug = require('debug')('windshaft:renderer:pg_mvt');
const PSQL = require('cartodb-psql');
const SubstitutionTokens = require('cartodb-query-tables').utils.substitutionTokens;
const Timer = require('../../stats/timer');
const DefaultQueryRewriter = require('../../utils/default-query-rewriter');
const WebMercatorHelper = require('cartodb-query-tables').utils.webMercatorHelper;
const webMercator = new WebMercatorHelper();

function shouldUseLayer (layer, zoom) {
    const minZoom = Number.isFinite(layer.options.minzoom) ? layer.options.minzoom : 0;
    const maxZoom = Number.isFinite(layer.options.maxzoom) ? layer.options.maxzoom : 30;
    return zoom >= minZoom && zoom <= maxZoom;
}

function extractMVT (data) {
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
    return SubstitutionTokens.replaceXYZ(sql, { x: 0, y: 0, z: 0 });
}

function removeTrailingSemiColon (sql) {
    return sql.replace(/\s*;\s*$/, '');
}

/**
 * Helper function to populate `layer._mvtColumns` with the columns to be
 * requested in the MVT tile SQL query
 * @param {Object} psql - Initialized cartodb-psql with the DB connection
 * @param {Object} layer - Map layers
 * @returns {Promise}
 */
function getLayerColumns (psql, layer) {
    return new Promise((resolve, reject) => {
        if (layer._mvtColumns) {
            return resolve();
        }

        if (!layer.options.sql) {
            return reject(new Error('Missing sql for layer'));
        }

        const layerSQL = setDefaultTokens(removeTrailingSemiColon(layer.options.sql), 0, 0, 0);
        const limitedQuery = `SELECT * FROM (${layerSQL}) __windshaft_mvt_schema LIMIT 0;`;

        psql.query(limitedQuery, function (err, data) {
            if (err) {
                if (err.message) {
                    err.message = 'PgMvtFactory: ' + err.message;
                }
                return reject(err);
            }

            // We filter by type id to avoid the implicit casts that ST_AsMVT does
            // from any unknown type to string
            // These are the list of compatible type oids as declared in
            // mapnik/plugins/input/postgis/postgis_datasource.cpp
            const COMPATIBLE_MVT_TYPEIDS = [
                16, // bool
                20, // int8
                21, // int2
                23, // int4
                700, // float4
                701, // float8
                1700, // numeric
                1042, // bpchar
                1043, // varchar
                25, // text
                705 // literal
            ];

            const metadataColumns = [];
            Object.keys(data.fields).forEach(function (key) {
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

module.exports = class PostgresVectorRenderer {
    constructor (layers, options = {}, dbParams = {}) {
        this.layers = layers;
        this.dbParams = dbParams;
        this.dbPoolParams = options.dbPoolParams;
        this.renderLimit = options.limits ? options.limits.render || 0 : 0;

        this.bufferSize = Object.prototype.hasOwnProperty.call(options, 'bufferSize') ? options.bufferSize : 64; // Same as Mapnik::bufferSize
        this.vectorExtent = options.vector_extent;
        this.vectorSimplifyExtent = options.vector_simplify_extent;
        this.subpixelBufferSize = Math.round(this.bufferSize * this.vectorExtent / webMercator.tileSize);
        this.queryRewriter = options.queryRewriter || new DefaultQueryRewriter();

        // May throw
        this.psql = new PSQL(this.dbParams, this.dbPoolParams);
    }

    // Retrieve the columns of all layers for later usage when requesting tiles
    async getAllLayerColumns () {
        const columnNamePromises = this.layers.map(layer => getLayerColumns(this.psql, layer));
        await Promise.all(columnNamePromises);

        return this;
    }

    async getTile (format, z, x, y) {
        const subqueries = this._getLayerQueries({ z, x, y });

        if (subqueries.length === 0) {
            return {
                buffer: Buffer.alloc(0),
                hearders: {
                    'Content-Type': 'application/x-protobuf',
                    'x-tilelive-contains-data': false
                },
                stats: {}
            };
        }

        const query = `SELECT ((${subqueries.join(') || (')})) AS st_asmvt`;

        try {
            const { buffer, headers, stats } = await this._getTilePromise(query);
            return { buffer, headers, stats };
        } catch (err) {
            if (err.message.match(/due to statement timeout/)) {
                throw new Error('Render timed out');
            }

            throw err;
        }
    }

    _getLayerQueries ({ z, x, y }) {
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
            const tol = (webMercator.tileMaxGeosize / Math.pow(2, z)) / (this.vectorSimplifyExtent * 2);
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
        const resolution = webMercator.getResolution({ z: z });
        const extent = webMercator.getExtent({ x: x, y: y, z: z });

        return SubstitutionTokens.replace(sql, {
            bbox: this.bufferSize ? `ST_Expand(!tile_bbox!, ${resolution * this.bufferSize})` : '!tile_bbox!',
            // See https://github.com/mapnik/mapnik/wiki/ScaleAndPpi#scale-denominator
            scale_denominator: `${resolution.dividedBy(0.00028)}`,
            pixel_width: `${resolution}`,
            pixel_height: `${resolution}`,
            tile_bbox: `ST_MakeEnvelope(${extent.xmin}, ${extent.ymin}, ${extent.xmax}, ${extent.ymax}, 3857)`
        });
    }

    _vectorLayerQuery (layer, geometryColumn, columns, query, { z, x, y }) {
        const layerId = layer.id;
        const geomColumn = layer.options.geom_column || 'the_geom_webmercator';
        const columnList = Array.isArray(columns) && columns.length > 0 ? `, "${columns.join('", "')}"` : '';
        const queryRewriteData = layer.options && layer.options.query_rewrite_data
            ? layer.options.query_rewrite_data
            : undefined;

        query = this.queryRewriter.query(removeTrailingSemiColon(query), queryRewriteData);

        return this._replaceTokens(
            `SELECT ST_AsMVT(geometries, '${layerId}', ${this.vectorExtent})
                FROM (
                    SELECT ${geometryColumn}${columnList}
                    FROM (${query}) AS cdbq
                    WHERE ${geomColumn} && !bbox!
                ) AS geometries
                `, { z, x, y });
    }

    _getTilePromise (query) {
        const timeoutLimit = this.renderLimit ? this.renderLimit : undefined;
        const readOnly = true;
        return new Promise((resolve, reject) => {
            const timer = new Timer();
            timer.start('query');

            this.psql.query(query, function (err, data) {
                timer.end('query');
                if (err) {
                    debug('Error running pg-mvt query ' + query + ': ' + err);
                    if (err.message) {
                        err.message = 'PgMvtRenderer: ' + err.message;
                    }
                    return reject(err);
                }

                const mvt = extractMVT(data);
                const headers = { 'Content-Type': 'application/x-protobuf' };
                headers['x-tilelive-contains-data'] = mvt !== null;

                const stats = timer.getTimes();

                return resolve({ buffer: mvt || Buffer.alloc(0), headers, stats });
            }, readOnly, timeoutLimit);
        });
    }
};
