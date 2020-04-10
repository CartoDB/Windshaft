'use strict';

const HttpRenderer = require('./http');
const BlendRenderer = require('./blend');
const TorqueRenderer = require('./torque');
const MapnikRenderer = require('./mapnik');
const PlainRenderer = require('./plain');
const PgMvtRenderer = require('./pg-mvt');
const layersFilter = require('../utils/layer-filter');

module.exports = class RendererFactory {
    constructor (opts) {
        opts.http = opts.http || {};
        opts.mapnik = opts.mapnik || {};
        opts.torque = opts.torque || {};
        opts.mvt = opts.mvt || {};
        if (opts.mapnik.mapnik) {
            opts.mvt.limits = opts.mapnik.mapnik.limits;
        }
        this.opts = opts;

        const availableFactories = [
            new MapnikRenderer.factory(opts.mapnik), // eslint-disable-line new-cap
            new TorqueRenderer.factory(opts.torque), // eslint-disable-line new-cap
            new PlainRenderer.factory(), // eslint-disable-line new-cap
            new BlendRenderer.factory(this), // eslint-disable-line new-cap
            new HttpRenderer.factory( // eslint-disable-line new-cap
                opts.http.whitelist,
                opts.http.timeout,
                opts.http.proxy,
                opts.http.fallbackImage
            ),
            new PgMvtRenderer.factory(opts.mvt) // eslint-disable-line new-cap
        ];

        this.factories = availableFactories.reduce((factories, factory) => {
            factories[factory.getName()] = factory;
            return factories;
        }, {});

        this.onTileErrorStrategy = opts.onTileErrorStrategy;
    }

    getFactory (mapConfig, layer, format) {
        const factoryName = this.getFactoryName(mapConfig, layer, format);
        return this.factories[factoryName];
    }

    getRenderer (mapConfig, params, context, callback) {
        if (Number.isFinite(+params.layer) && !mapConfig.getLayer(params.layer)) {
            return callback(new Error("Layer '" + params.layer + "' not found in layergroup"));
        }

        let factory;
        try {
            factory = this.getFactory(mapConfig, params.layer, params.format);
        } catch (err) {
            return callback(err);
        }

        if (!factory) {
            return callback(new Error("Type for layer '" + params.layer + "' not supported"));
        }

        if (!factory.supportsFormat(params.format)) {
            return callback(new Error('Unsupported format ' + params.format));
        }

        return this._genericMakeRenderer(factory, mapConfig, params, context, callback);
    }

    _genericMakeRenderer (factory, mapConfig, params, context, callback) {
        const format = params.format;
        const options = {
            params: params,
            layer: params.layer,
            limits: context.limits || {}
        };

        // waiting for async/await to refactor
        try {
            factory.getRenderer(mapConfig, format, options, (err, renderer) => {
                if (err) {
                    return callback(err);
                }

                const onTileErrorStrategy = context.onTileErrorStrategy || this.onTileErrorStrategy;

                try {
                    const rendererAdaptor = factory.getAdaptor(renderer, onTileErrorStrategy);
                    return callback(null, rendererAdaptor);
                } catch (error) {
                    return callback(error);
                }
            });
        } catch (error) {
            return callback(error);
        }
    }

    getFactoryName (mapConfig, layer, format) {
        if (isMapnikFactory(mapConfig, layer, format)) {
            if (this.opts.mvt.usePostGIS && format === 'mvt') {
                return PgMvtRenderer.factory.NAME;
            }

            return MapnikRenderer.factory.NAME;
        }

        if (layersFilter.isSingleLayer(layer)) {
            return mapConfig.layerType(layer);
        }

        return BlendRenderer.factory.NAME;
    }
};

function isMapnikFactory (mapConfig, layer) {
    const filteredLayers = layersFilter(mapConfig, layer);
    return filteredLayers
        .map(index => mapConfig.layerType(index))
        .every(type => type === 'mapnik');
}
