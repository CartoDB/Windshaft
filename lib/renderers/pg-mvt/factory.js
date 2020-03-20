'use strict';

const layersFilter = require('../../utils/layer-filter');
const RendererParams = require('../renderer-params');
const Renderer = require('./renderer');
const BaseAdaptor = require('../base-adaptor');

/**
 * API: initializes the renderer, it should be called once
 *
 * @param {Object} options
 *      - dbPoolParams: database connection pool params
 *          - size: maximum number of resources to create at any given time
 *          - idleTimeout: max milliseconds a resource can go unused before it should be destroyed
 *          - reapInterval: frequency to check for idle resources
 */
function PgMvtFactory (options) {
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

    getAdaptor: function (renderer, onTileErrorStrategy) {
        return new BaseAdaptor(renderer, onTileErrorStrategy);
    },

    getRenderer: function (mapConfig, format, options, callback) {
        if (mapConfig.isVectorOnlyMapConfig() && format !== MVT_FORMAT) {
            const error = new Error(`Unsupported format: 'cartocss' option is missing for ${format}`);
            error.http_status = 400;
            error.type = 'tile';
            return callback(error);
        }

        if (!this.supportsFormat(format)) {
            return callback(new Error('format not supported: ' + format));
        }

        const mapLayers = mapConfig.getLayers();
        mapLayers.forEach((layer, layerIndex) => {
            layer.id = mapConfig.getLayerId(layerIndex);
        });

        const filteredLayers = layersFilter(mapConfig, options.layer);
        if (filteredLayers.length < 1) {
            return callback(new Error('no mapnik layer in mapConfig'));
        }

        const layers = filteredLayers.map(layerIndex => mapConfig.getLayer(layerIndex));
        const dbParams = RendererParams.dbParamsFromReqParams(options.params);
        Object.assign(dbParams, mapConfig.getLayerDatasource(options.layer));

        if (Number.isFinite(mapConfig.getBufferSize(MVT_FORMAT))) {
            this.options.bufferSize = mapConfig.getBufferSize(MVT_FORMAT);
        }

        try {
            const mapExtents = mapConfig.getMVTExtents();
            this.options.vector_extent = mapExtents.extent;
            this.options.vector_simplify_extent = mapExtents.simplify_extent;

            const mvtRenderer = new Renderer(layers, this.options, dbParams);
            mvtRenderer.getAllLayerColumns()
                .then((renderer) => callback(null, renderer))
                .catch((err) => callback(err));
        } catch (err) {
            return callback(err);
        }
    }
};
