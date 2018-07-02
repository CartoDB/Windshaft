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
        this.buffer_size = options.bufferSize || 0; // Same as Mapnik::bufferSize
        this.mvt_extent = options.mvt_extent || 4096;
    }



    /// API: renders a tile with the Renderer configuration
    /// @param x tile x coordinate
    /// @param y tile y coordinate
    /// @param z tile zoom
    /// callback: will be called when done using nodejs protocol (err, data)
    getTile (z, x, y, callback) {
        const subqueriesPromises = this._getLayerQueries({ z, x, y });
        const empty_tile_msg = 'Tile does not exist';
        Promise.all(subqueriesPromises)
        .then(subqueries =>  {
            if (subqueries.length === 0) {
                return callback(new Error(empty_tile_msg));
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
                if (!mvt) {
                    return callback(new Error(empty_tile_msg));
                }

                const headers = { 'Content-Type': 'application/x-protobuf' };
                const stats = timer.getTimes();

                return callback(null, mvt, headers, stats);
            });
        }, err => { return callback(err); })
        .catch(() => { }); // Avoids UnhandledPromiseRejectionWarning
    }

    _getLayerColumns (layer) {
        return new Promise((resolve, reject) => {
            if (layer._metadata_columns) {
                resolve(layer._metadata_columns);
            }
            const layerSQL = this._replaceTokens(layer.options.sql, 0, 0, 0);
            const limitedQuery = `SELECT * FROM (${layerSQL}) __windshaft_mvt_schema LIMIT 0;`;

            this.psql.query(limitedQuery, function (err, data) {
                if (err) {
                    if (err.message) {
                        err.message = "PgMvtRenderer: " + err.message;
                    }
                    return reject(err);
                }
                else {
                    // We filter here by type id to avoid the implicit casts that ST_AsMVT does
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

                    let _metadata_columns = [];
                    Object.keys(data.fields).forEach(function(key){
                        const val = data.fields[key];
                        if (COMPATIBLE_MVT_TYPEIDS.includes(val.dataTypeID)) {
                            _metadata_columns.push(val.name);
                        }
                    });
                    resolve(_metadata_columns);
                }
            });
        });
    }

    _getLayerQueries({ z, x, y }) {
        return this.layers.filter(l => shouldUseLayer(l, z)).map(layer => {
            return this._getLayerColumns(layer)
                .then( layerColumns => {
                    const geomColumn = this._geomColumn(layer, { z, x, y });
                    const columns = [geomColumn].concat(layerColumns);
                    const query = this._replaceTokens(layer.options.sql, { z, x, y });
                    const finalQuery = this._vectorLayerQuery(layer, columns, query, { z, x, y });
                    return finalQuery;
                });
        });
    }

    _geomColumn (layer, { z, x, y }) {
        // Geometry column
        const subpixelBufferSize = Math.round(this.buffer_size * this.mvt_extent / this.tile_size);
        const geomColumn = layer.options.geom_column || 'the_geom_webmercator';
        return `
        ST_AsMVTGeom(
            ${geomColumn},
            CDB_XYZ_Extent(${x},${y},${z}),
            ${this.mvt_extent},
            ${subpixelBufferSize},
            true
        ) as the_geom_webmercator
        `;
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

    _vectorLayerQuery (layer, columns, query, { z, x, y }) {
        const layerId = layer.id;
        const geomColumn = layer.options.geom_column || 'the_geom_webmercator';

        return `
SELECT ST_AsMVT(geom, '${layerId}')
FROM (
    SELECT ${columns.join(', ')}
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
