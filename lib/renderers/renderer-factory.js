'use strict';

const HttpRendererFactory = require('./http/factory');
const BlendRendererFactory = require('./blend/factory');
const TorqueRendererFactory = require('./torque/factory');
const MapnikRendererFactory = require('./mapnik/factory');
const PlainRendererFactory = require('./plain/factory');
const PgMvtRendererFactory = require('./pg-mvt/factory');
const layersFilter = require('../utils/layer-filter');

module.exports = class RendererFactory {
    constructor ({ mapnik = {}, mvt = {}, torque = {}, http = {}, onTileErrorStrategy } = {}) {
        this.onTileErrorStrategy = onTileErrorStrategy;
        this.usePgMvt = mvt && mvt.usePostGIS;
        mvt.limits = mapnik && mapnik.mapnik && mapnik.mapnik.limits;
        this.factories = {
            [MapnikRendererFactory.NAME]: new MapnikRendererFactory(mapnik),
            [TorqueRendererFactory.NAME]: new TorqueRendererFactory(torque),
            [PlainRendererFactory.NAME]: new PlainRendererFactory(),
            [BlendRendererFactory.NAME]: new BlendRendererFactory(this),
            [HttpRendererFactory.NAME]: new HttpRendererFactory(http),
            [PgMvtRendererFactory.NAME]: new PgMvtRendererFactory(mvt)
        };
    }

    getFactory (mapConfig, layer, format) {
        const factoryName = this.getFactoryName(mapConfig, layer, format);
        return this.factories[factoryName];
    }

    getRenderer (mapConfig, params, context, callback) {
        const { format, layer } = params;

        if (Number.isFinite(+layer) && !mapConfig.getLayer(layer)) {
            return callback(new Error(`Layer '${layer}' not found in layergroup`));
        }

        let factory;
        try {
            factory = this.getFactory(mapConfig, layer, format);
        } catch (err) {
            return callback(err);
        }

        if (!factory) {
            return callback(new Error(`Type for layer '${layer}' not supported`));
        }

        if (!factory.supportsFormat(format)) {
            return callback(new Error(`Unsupported format ${format}`));
        }

        const { limits = {} } = context;
        const options = { params, layer, limits };

        factory.getRenderer(mapConfig, format, options, (err, renderer) => {
            if (err) {
                return callback(err);
            }

            const { onTileErrorStrategy = this.onTileErrorStrategy } = context;
            const rendererAdaptor = factory.getAdaptor(renderer, onTileErrorStrategy);

            return callback(null, rendererAdaptor);
        });
    }

    getFactoryName (mapConfig, layer, format) {
        if (isMapnikFactory(mapConfig, layer, format)) {
            if (this.usePgMvt && format === 'mvt') {
                return PgMvtRendererFactory.NAME;
            }

            return MapnikRendererFactory.NAME;
        }

        if (layersFilter.isSingleLayer(layer)) {
            return mapConfig.layerType(layer);
        }

        return BlendRendererFactory.NAME;
    }
};

function isMapnikFactory (mapConfig, layer) {
    const filteredLayers = layersFilter(mapConfig, layer);
    return filteredLayers
        .map(index => mapConfig.layerType(index))
        .every(type => type === 'mapnik');
}
