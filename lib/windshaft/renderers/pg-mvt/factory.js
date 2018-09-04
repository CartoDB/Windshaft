const _ = require('underscore');
const PSQL = require('cartodb-psql');
const layersFilter = require('../../utils/layer_filter');

const RendererParams = require('../renderer_params');

const Renderer = require('./renderer');
const BaseAdaptor = require('../base_adaptor');
const SubstitutionTokens = require('../../utils/substitution_tokens');

/**
 * API: initializes the renderer, it should be called once
 *
 * @param {Object} options
 *      - dbPoolParams: database connection pool params
 *          - size: maximum number of resources to create at any given time
 *          - idleTimeout: max milliseconds a resource can go unused before it should be destroyed
 *          - reapInterval: frequency to check for idle resources
 */
function PgMvtFactory(options) {
    this.options = options || {};
}


function setDefaultTokens (sql) {
    return SubstitutionTokens.replace(sql, {
        bbox: `CDB_XYZ_Extent(0,0,0)`,
        scale_denominator: `0`,
        pixel_width: `0`,
        pixel_height: `0`,
        var_zoom: `0`,
        var_x: `0`,
        var_y: `0`
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

module.exports = PgMvtFactory;
const NAME = 'pg-mvt';
const MVT_FORMAT = 'mvt';
module.exports.NAME = NAME;

PgMvtFactory.prototype = {
    /// API: renderer name, use for information purposes
    name: NAME,

    /// API: tile formats this module is able to render
    supported_formats: [MVT_FORMAT],

    getName: function () {
        return this.name;
    },

    supportsFormat: function (format) {
        return format === MVT_FORMAT;
    },

    getAdaptor: function (renderer, format, onTileErrorStrategy) {
        return new BaseAdaptor(renderer, format, onTileErrorStrategy);
    },

    getRenderer: function (mapConfig, format, options, callback) {
        if (mapConfig.isVectorOnlyMapConfig() && format !== MVT_FORMAT) {
            const error = new Error(`Unsupported format: 'cartocss' option is missing for ${format}`);
            error.http_status = 400;
            error.type = 'tile';
            return callback(error);
        }

        if (!this.supportsFormat(format)) {
            return callback(new Error("format not supported: " + format));
        }

        const mapLayers = mapConfig.getLayers();
        mapLayers.forEach((layer, layerIndex) => {
            layer.id = mapConfig.getLayerId(layerIndex);
        });

        const filteredLayers = layersFilter(mapConfig, options.layer);
        if (filteredLayers.length < 1) {
            return callback(new Error("no mapnik layer in mapConfig"));
        }

        const layers = filteredLayers.map(layerIndex => mapConfig.getLayer(layerIndex));
        let dbParams = RendererParams.dbParamsFromReqParams(options.params);
        _.extend(dbParams, mapConfig.getLayerDatasource(options.layer));
        const psql = new PSQL(dbParams, this.options.dbPoolParams);

        if (Number.isFinite(mapConfig.getBufferSize(MVT_FORMAT))) {
            this.options.bufferSize = mapConfig.getBufferSize(MVT_FORMAT);
        }

        mapConfig.getMVTExtents((err, extent, simplify_extent) => {
            if (err) {
                return callback(err);
            }

            this.options.vector_extent = extent;
            this.options.vector_simplify_extent = simplify_extent;

            const columnNamePromises = layers.map(layer => getLayerColumns(psql, layer));
            Promise.all(columnNamePromises)
            .then(() => callback(null, new Renderer(layers, psql, {}, this.options)))
            .catch(err => callback(err));
        });
    }
};
