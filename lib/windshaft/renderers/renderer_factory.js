var HttpRenderer = require('./http');
var BlendRenderer = require('./blend');
var TorqueRenderer = require('./torque');
var MapnikRenderer = require('./mapnik');
var PlainRenderer = require('./plain');

var RendererParams = require('./renderer_params');

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
}

module.exports = RendererFactory;


RendererFactory.prototype.makeRenderer = function(mapConfig, params, callback) {
    // This is due to previous implementation relying on the requested format (format param) to decide which is the
    // renderer instead of trying to render the requested layer (layer param) using the format and failing if the layer
    // doesn't have a renderer for that format.
    // Do NOT consider end points based on layer + format params as final ones, these might change in the future and it
    // will only be backwards compatible for previously existing combinations.
    if ( params.layer === 'all' ) {
        this.makeRendererBlend(params, mapConfig, callback);
    }
    else if ( params.format.match(/^(png|grid\.json)$/) ) {
        this.makeRendererMapnik(params, mapConfig, callback);
    }
    else if ( params.format.match(/torque/) ) {
        this.makeRendererTorque(params, mapConfig, callback);
    }
    else if ( params.format.match(/http/) ) {
        this.makeRendererHttp(params, mapConfig, callback);
    }
    else {
        callback(new Error("Unsupported format " + params.format));
    }
};

RendererFactory.prototype.makeRendererMapnik = function(params, mapConfig, callback) {
    return genericMakeRenderer(
        this.mapnikRendererFactory, MapnikRenderer.adaptor, mapConfig, params, params.format, params.layer, callback
    );
};

RendererFactory.prototype.makeRendererTorque = function(params, mapConfig, callback) {
    if (!validateTokenAndLayerPresence(params)) {
        return callback(createMapTokenLayerIdError('Torque'));
    }

    var dbParams = RendererParams.dbParamsFromReqParams(params);
    return genericMakeRenderer(
        this.torqueRendererFactory, TorqueRenderer.adaptor, mapConfig, dbParams, params.format, params.layer, callback
    );
};

RendererFactory.prototype.makeRendererHttp = function(params, mapConfig, callback) {
    return defaultMakeRenderer(this.httpRendererFactory, HttpRenderer.adaptor, mapConfig, params, callback);
};

RendererFactory.prototype.makeRendererPlain = function(params, mapConfig, callback) {
    return defaultMakeRenderer(this.plainRendererFactory, PlainRenderer.adaptor, mapConfig, params, callback);
};

RendererFactory.prototype.makeRendererBlend = function(params, mapConfig, callback) {
    if (!params.token) {
        return callback(new Error("Blend renderer can only be initialized with map token"));
    }

    return genericMakeRenderer(
        this.blendRendererFactory, BlendRenderer.adaptor, mapConfig, params, 'png', null, callback
    );
};

function defaultMakeRenderer(factory, AdaptorClass, mapConfig, params, callback) {
    if (!validateTokenAndLayerPresence(params)) {
        return callback(createMapTokenLayerIdError(factory.name));
    }

    return genericMakeRenderer(factory, AdaptorClass, mapConfig, params, params.format, params.layer, callback);
}

function genericMakeRenderer(factory, AdaptorClass, mapConfig, params, format, layer, callback) {
    var options = {
        params: params,
        layer: layer
    };
    step(
        function initRenderer() {
            factory.getRenderer(mapConfig, format, options, this);
        },
        function makeAdaptor(err, renderer) {
            assert.ifError(err);
            return new AdaptorClass(renderer, format);
        },
        function returnCallback(err, renderer){
            return callback(err, renderer);
        }
    );
}

function createMapTokenLayerIdError(rendererName) {
    return new Error(capitalize(rendererName) + " renderer can only be initialized with map token and layer id");
}

function validateTokenAndLayerPresence(params) {
    return params.token && params.hasOwnProperty('layer');
}

function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.substring(1).toLowerCase();
}
