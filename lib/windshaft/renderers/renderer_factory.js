var HttpRenderer = require('./http');
var BlendRenderer = require('./blend');
var TorqueRenderer = require('./torque');
var MapnikRenderer = require('./mapnik');
var PlainRenderer = require('./plain');

var step = require('step');
var assert = require('assert');


function RendererFactory(opts) {
    opts.http = opts.http || {};
    this.httpRendererFactory = new HttpRenderer.factory(
        opts.http.whitelist,
        opts.http.timeout,
        opts.http.proxy,
        opts.http.fallbackImage
    );

    opts.mapnik = opts.mapnik || {};
    this.mapnikRendererFactory = new MapnikRenderer.factory(opts.mapnik.mmlStore, { mapnik_opts: opts.mapnik.opts });

    this.torqueRendererFactory = new TorqueRenderer.factory(); // TODO: specify options

    this.plainRendererFactory = new PlainRenderer.factory();

    this.blendRendererFactory = new BlendRenderer.factory(this);

    var availableFactories = [
        new MapnikRenderer.factory(opts.mapnik.mmlStore, { mapnik_opts: opts.mapnik.opts }),
        new TorqueRenderer.factory(),
        new PlainRenderer.factory(),
        new BlendRenderer.factory(this),
        new HttpRenderer.factory(
            opts.http.whitelist,
            opts.http.timeout,
            opts.http.proxy,
            opts.http.fallbackImage
        )
    ];
    this.factories = availableFactories.reduce(function(factories, factory) {
        factories[factory.getName()] = factory;
        return factories;
    }, {});

    this.onTileErrorStrategy = opts.onTileErrorStrategy;
}

module.exports = RendererFactory;

RendererFactory.prototype.getFactory = function(mapConfig, layer) {
    var layerType = mapConfig.layerType(layer);
    return this.factories[layerType];
};

// jshint maxcomplexity:7
RendererFactory.prototype.makeRenderer = function (mapConfig, params, context, callback) {
    var limits = context.limits || {};
    // This is due to previous implementation relying on the requested format (format param) to decide which is the
    // renderer instead of trying to render the requested layer (layer param) using the format and failing if the layer
    // doesn't have a renderer for that format.
    // Do NOT consider end points based on layer + format params as final ones, these might change in the future and it
    // will only be backwards compatible for previously existing combinations.

    // mapnik renderer when no layer is selected
    if (typeof params.layer === 'undefined') {
        return this.makeRendererMapnik(mapConfig, params, limits, callback);
    }

    // aliases, like `all`, `raster`
    if (params.layer === 'all') {
        return this.makeRendererBlend(mapConfig, params, limits, callback);
    }

    if (!mapConfig.getLayer(params.layer)) {
        return callback(new Error("Layer '" + params.layer + "' not found in layergroup"));
    }

    var factory = this.getFactory(mapConfig, params.layer);
    if (!factory) {
        return callback(new Error("Type for layer '" + params.layer + "' not supported"));
    }

    if (!factory.supportsFormat(params.format)) {
        return callback(new Error("Unsupported format " + params.format));
    }

    return genericMakeRenderer(factory, mapConfig, params, params.format, params.layer, limits,
        this.onTileErrorStrategy, callback);
};

RendererFactory.prototype.makeRendererMapnik = function (mapConfig, params, limits, callback) {
    return genericMakeRenderer(this.mapnikRendererFactory, mapConfig, params, params.format, params.layer, limits,
        this.onTileErrorStrategy, callback);
};

RendererFactory.prototype.makeRendererTorque = function (mapConfig, params, callback) {
    return genericMakeRenderer(this.torqueRendererFactory, mapConfig, params, params.format, params.layer, {},
        callback);
};

RendererFactory.prototype.makeRendererHttp = function (mapConfig, params, callback) {
    return defaultMakeRenderer(this.httpRendererFactory, mapConfig, params, callback);
};

RendererFactory.prototype.makeRendererPlain = function (mapConfig, params, callback) {
    return defaultMakeRenderer(this.plainRendererFactory, mapConfig, params, callback);
};

RendererFactory.prototype.makeRendererBlend = function (mapConfig, params, limits, callback) {
    return genericMakeRenderer(this.blendRendererFactory, mapConfig, params, 'png', null, limits, callback);
};

function defaultMakeRenderer(factory, mapConfig, params, callback) {
    return genericMakeRenderer(factory, mapConfig, params, params.format, params.layer, {}, callback);
}

function genericMakeRenderer(factory, mapConfig, params, format, layer, limits, onTileErrorStrategy, callback) {
    if (!callback) {
        callback = onTileErrorStrategy;
        onTileErrorStrategy = null;
    }
    var options = {
        params: params,
        layer: layer,
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
        function returnCallback(err, renderer){
            return callback(err, renderer);
        }
    );
}
