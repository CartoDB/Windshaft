var HttpRenderer = require('./http');
var BlendRenderer = require('./blend');
var TorqueRenderer = require('./torque');
var MapnikRenderer = require('./mapnik');
var PlainRenderer = require('./plain');
var PgMvtRenderer = require('./pg-mvt');
var layersFilter = require('../utils/layer_filter');

var step = require('step');
var assert = require('assert');


function RendererFactory(opts) {
    opts.http = opts.http || {};
    opts.mapnik = opts.mapnik || {};
    opts.torque = opts.torque || {};
    opts.mvt = opts.mvt || {};
    this.opts = opts;

    this.mapnikRendererFactory = new MapnikRenderer.factory(opts.mapnik);
    this.blendRendererFactory = new BlendRenderer.factory(this);

    var availableFactories = [
        this.mapnikRendererFactory,
        new TorqueRenderer.factory(opts.torque),
        new PlainRenderer.factory(),
        this.blendRendererFactory,
        new HttpRenderer.factory(
            opts.http.whitelist,
            opts.http.timeout,
            opts.http.proxy,
            opts.http.fallbackImage
        ),
        new PgMvtRenderer.factory(opts.mvt)
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
    var limits = context.limits || {};

    if (Number.isFinite(+params.layer) && !mapConfig.getLayer(params.layer)) {
        return callback(new Error("Layer '" + params.layer + "' not found in layergroup"));
    }

    var factory = this.getFactory(mapConfig, params.layer, params.format);
    if (!factory) {
        return callback(new Error("Type for layer '" + params.layer + "' not supported"));
    }

    if (!factory.supportsFormat(params.format)) {
        return callback(new Error("Unsupported format " + params.format));
    }

    var onTileErrorStrategy = context.onTileErrorStrategy || this.onTileErrorStrategy;

    return genericMakeRenderer(factory, mapConfig, params, limits, onTileErrorStrategy, callback);
};

function genericMakeRenderer(factory, mapConfig, params, limits, onTileErrorStrategy, callback) {
    var format = params.format;
    var options = {
        params: params,
        layer: params.layer,
        limits: limits
    };
    step(
        function initRenderer() {
            factory.getRenderer(mapConfig, format, options, this);
        },
        function makeAdaptor(err, renderer) {
            assert.ifError(err);
            return factory.getAdaptor(renderer, format, onTileErrorStrategy);
        },
        function returnCallback(err, renderer) {
            return callback(err, renderer);
        }
    );
}

RendererFactory.prototype.getFactoryName = function (mapConfig, layer, format) {
    var factoryName = mapConfig.layerType(layer);
    if ((factoryName == 'http' || factoryName == 'torque' || factoryName == 'plain') &&
        layersFilter(mapConfig, mapConfig.getLayers(), layer).length == 1) {
        return factoryName;
    }
    if (isMapnikFactory(mapConfig, layer, format)) {
        if (this.opts.mvt.usePostGIS && format === 'mvt') {
            return PgMvtRenderer.factory.NAME;
        }
        return MapnikRenderer.factory.NAME;
    }
    if (isBlendFactory(layer)) {
        return BlendRenderer.factory.NAME;
    }
    throw new Error('Invalid layer filtering')
};

function isMapnikFactory(mapConfig, layer, format) {
    // mapnik renderer when no layer is selected
    if (typeof layer === 'undefined') {
        return true;
    }

    if (layer === 'mapnik') {
        return true;
    }

    if (format === 'geojson') {
        return true;
    }
    if (layersFilter.isFilter(layer) && isEveryMapnik(mapConfig, layer)) {
        return true;
    }

    if (layersFilter.isFilterByLayerId(layer) && isEveryMapnikByLayerId(mapConfig, layer)) {
        return true;
    }

    return false;
}

function isBlendFactory(layer) {
    if (layersFilter.isFilter(layer)) {
        return true;
    }

    if (layersFilter.isFilterByLayerId(layer)) {
        return true;
    }

    // aliases, like `all`, `raster`
    if (isAliasFilter(layer)) {
        return true;
    }

    return false;
}

function isEveryMapnik(mapConfig, layer) {
    var filteredLayers = layersFilter(mapConfig, mapConfig.getLayers(), layer);
    var isEveryLayerMapnik = filteredLayers.every(function (filteredLayer) {
        return mapConfig.layerType(filteredLayer) === 'mapnik';
    });

    if (isEveryLayerMapnik) {
        return true;
    }

    return false;
}

function isEveryMapnikByLayerId(mapConfig, layer) {
    return layer.split(',')
        .map(function (layerId) {
            return mapConfig.getIndexByLayerId(layerId);
        })
        .every(function (layerIndex) {
            return mapConfig.layerType(layerIndex) === 'mapnik';
        });
}

function isAliasFilter(layer) {
    var acceptedAliases = {
        all: true,
        raster: true
    };

    return !Number.isFinite(+layer) && acceptedAliases[layer];
}
