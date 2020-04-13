'use strict';

const layersFilter = require('../../utils/layer-filter');
const parseDbParams = require('../renderer-params');
const Renderer = require('./renderer');
const BaseAdaptor = require('../base-adaptor');

module.exports = class PgMvtFactory {
    static get NAME () {
        return 'pg-mvt';
    }

    static get MVT_FORMAT () {
        return 'mvt';
    }

    constructor (options = {}) {
        this.options = options;
    }

    getName () {
        return PgMvtFactory.NAME;
    }

    supportsFormat (format) {
        return format === PgMvtFactory.MVT_FORMAT;
    }

    getAdaptor (renderer, onTileErrorStrategy) {
        return new BaseAdaptor(renderer, onTileErrorStrategy);
    }

    getRenderer (mapConfig, format, options, callback) {
        if (mapConfig.isVectorOnlyMapConfig() && format !== PgMvtFactory.MVT_FORMAT) {
            const error = new Error(`Unsupported format: 'cartocss' option is missing for ${format}`);
            error.http_status = 400;
            error.type = 'tile';
            return callback(error);
        }

        if (!this.supportsFormat(format)) {
            return callback(new Error(`format not supported: ${format}`));
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
        const dbParams = parseDbParams(options.params);
        Object.assign(dbParams, mapConfig.getLayerDatasource(options.layer));

        if (Number.isFinite(mapConfig.getBufferSize(PgMvtFactory.MVT_FORMAT))) {
            this.options.bufferSize = mapConfig.getBufferSize(PgMvtFactory.MVT_FORMAT);
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
