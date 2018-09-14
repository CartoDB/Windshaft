const _ = require('underscore');
const layersFilter = require('../../utils/layer_filter');

const RendererParams = require('../renderer_params');

const Renderer = require('./renderer');
const BaseAdaptor = require('../base_adaptor');

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

        if (Number.isFinite(mapConfig.getBufferSize(MVT_FORMAT))) {
            this.options.bufferSize = mapConfig.getBufferSize(MVT_FORMAT);
        }


        try {
            const map_extents = mapConfig.getMVTExtents();
            this.options.vector_extent = map_extents.extent;
            this.options.vector_simplify_extent = map_extents.simplify_extent;

            const mvt_renderer = new Renderer(layers, this.options, dbParams);
            mvt_renderer.getAllLayerColumns(callback);
        } catch(err) {
            return callback(err);
        }
    }
};
