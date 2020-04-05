'use strict';

var HttpRenderer = require('./http');
var BlendRenderer = require('./blend');
var TorqueRenderer = require('./torque');
var MapnikRenderer = require('./mapnik');
var PlainRenderer = require('./plain');
var PgMvtRenderer = require('./pg-mvt');
var layersFilter = require('../utils/layer-filter');

function RendererFactory (opts) {
    opts.http = opts.http || {};
    opts.mapnik = opts.mapnik || {};
    opts.torque = opts.torque || {};
    opts.mvt = opts.mvt || {};
    if (opts.mapnik.mapnik) {
        opts.mvt.limits = opts.mapnik.mapnik.limits;
    }
    this.opts = opts;

    this.mapnikRendererFactory = new MapnikRenderer.factory(opts.mapnik); // eslint-disable-line new-cap
    this.blendRendererFactory = new BlendRenderer.factory(this); // eslint-disable-line new-cap

    var availableFactories = [
        this.mapnikRendererFactory,
        new TorqueRenderer.factory(opts.torque), // eslint-disable-line new-cap
        new PlainRenderer.factory(), // eslint-disable-line new-cap
        this.blendRendererFactory,
        new HttpRenderer.factory( // eslint-disable-line new-cap
            opts.http.whitelist,
            opts.http.timeout,
            opts.http.proxy,
            opts.http.fallbackImage
        ),
        new PgMvtRenderer.factory(opts.mvt) // eslint-disable-line new-cap
    ];
    this.factories = availableFactories.reduce(function (factories, factory) {
        factories[factory.getName()] = factory;
        return factories;
    }, {});

    this.onTileErrorStrategy = opts.onTileErrorStrategy;
}

module.exports = RendererFactory;

RendererFactory.prototype.getFactory = function (mapConfig, layer, format) {
    var factoryName = this.getFactoryName(mapConfig, layer, format);
    return this.factories[factoryName];
};

RendererFactory.prototype.getRenderer = function (mapConfig, params, context, callback) {
    if (Number.isFinite(+params.layer) && !mapConfig.getLayer(params.layer)) {
        return callback(new Error("Layer '" + params.layer + "' not found in layergroup"));
    }

    var factory;
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

    return this.genericMakeRenderer(factory, mapConfig, params, context, callback);
};

RendererFactory.prototype.genericMakeRenderer = function (factory, mapConfig, params, context, callback) {
    var format = params.format;
    var options = {
        params: params,
        layer: params.layer,
        limits: context.limits || {}
    };
    var onTileErrorStrategy = context.onTileErrorStrategy || this.onTileErrorStrategy;

    // waiting for async/await to refactor
    try {
        factory.getRenderer(mapConfig, format, options, function (err, renderer) {
            if (err) {
                return callback(err);
            }

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
};

RendererFactory.prototype.getFactoryName = function (mapConfig, layer, format) {
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
};

function isMapnikFactory (mapConfig, layer) {
    var filteredLayers = layersFilter(mapConfig, layer);
    return filteredLayers
        .map(index => mapConfig.layerType(index))
        .every(type => type === 'mapnik');
}
