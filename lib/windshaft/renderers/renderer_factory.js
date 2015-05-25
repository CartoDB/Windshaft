var HttpRenderer = require('./http');
var BlendRenderer = require('./blend');
var TorqueRenderer = require('./torque');
var MapnikRenderer = require('./mapnik');
var PlainRenderer = require('./plain');

var step = require('step');
var assert = require('assert');


function RendererFactory(opts) {
    opts.http = opts.http || {};
    opts.mapnik = opts.mapnik || {};

    this.mapnikRendererFactory = new MapnikRenderer.factory(opts.mapnik.mmlStore, { mapnik_opts: opts.mapnik.opts });
    this.blendRendererFactory = new BlendRenderer.factory(this);

    var availableFactories = [
        this.mapnikRendererFactory,
        new TorqueRenderer.factory(),
        new PlainRenderer.factory(),
        this.blendRendererFactory,
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
    // mapnik renderer when no layer is selected
    if (typeof layer === 'undefined') {
        return this.mapnikRendererFactory;
    }

    // aliases, like `all`, `raster`
    if (!Number.isFinite(+layer)) {
        return this.blendRendererFactory;
    }

    var layerType = mapConfig.layerType(layer);
    return this.factories[layerType];
};

RendererFactory.prototype.getRenderer = function (mapConfig, params, context, callback) {
    var limits = context.limits || {};

    if (Number.isFinite(+params.layer) && !mapConfig.getLayer(params.layer)) {
        return callback(new Error("Layer '" + params.layer + "' not found in layergroup"));
    }

    var factory = this.getFactory(mapConfig, params.layer);
    if (!factory) {
        return callback(new Error("Type for layer '" + params.layer + "' not supported"));
    }

    if (!factory.supportsFormat(params.format)) {
        return callback(new Error("Unsupported format " + params.format));
    }

    return genericMakeRenderer(factory, mapConfig, params, limits, this.onTileErrorStrategy, callback);
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
        function returnCallback(err, renderer){
            return callback(err, renderer);
        }
    );
}
