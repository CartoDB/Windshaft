var HttpRenderer = require('./http');
var BlendRenderer = require('./blend');
var TorqueRenderer = require('./torque');
var MapnikRenderer = require('./mapnik');
var PlainRenderer = require('./plain');

var RendererParams = require('./renderer_params');

var Step = require('step');




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

// controls the instantiation of mapnik renderer objects from mapnik XML
RendererFactory.prototype.makeRendererMapnik = function(params, mapConfig, callback){
    var self = this;

    // returns a tilelive renderer by:
    // 1. generating or retrieving mapnik XML
    // 2. configuring a full mml document with mapnik XML, interactivity and other elements set
    Step(
        function initRenderer() {
            self.mapnikRendererFactory.getRenderer(mapConfig, params, params.format, params.layer, this);
        },
        function makeAdaptor(err, source){
            if ( err ) throw err;
            return new MapnikRenderer.adaptor(source, params.format);
        },
        function returnCallback(err, source){
            callback(err, source);
        }
    );
};

// controls the instantiation of mapnik renderer objects from mapnik XML
RendererFactory.prototype.makeRendererTorque = function(params, mapConfig, callback){
    var self = this;

    if ( ! params.token || ! params.hasOwnProperty('layer') ) {
        callback(new Error("Torque renderer can only be initialized with map token and layer id"));
        return;
    }

    Step(
        function initRenderer() {
            var dbParams = RendererParams.dbParamsFromReqParams(params);
            var format = params.format;
            var layer = params.layer;
            self.torqueRendererFactory.getRenderer(mapConfig, dbParams, format, layer, this);
        },
        function makeAdaptor(err, renderer){
            if ( err ) throw err;
            return new TorqueRenderer.adaptor(renderer);
        },
        function returnCallback(err, renderer){
            callback(err, renderer);
        }
    );
};

RendererFactory.prototype.makeRendererHttp = function(params, mapConfig, callback) {
    var self = this;

    if ( ! params.token || ! params.hasOwnProperty('layer') ) {
        callback(new Error("Http renderer can only be initialized with map token and layer id"));
        return;
    }

    Step(
        function initRenderer() {
            self.httpRendererFactory.getRenderer(mapConfig, {}, params.format, params.layer, this);
        },
        function makeAdaptor(err, renderer){
            if ( err ) throw err;
            return new HttpRenderer.adaptor(renderer);
        },
        function returnCallback(err, renderer){
            callback(err, renderer);
        }
    );
};

RendererFactory.prototype.makeRendererPlain = function(params, mapConfig, callback) {
    var self = this;

    if ( ! params.token || ! params.hasOwnProperty('layer') ) {
        callback(new Error("Plain renderer can only be initialized with map token and layer id"));
        return;
    }

    Step(
        function initRenderer() {
            self.plainRendererFactory.getRenderer(mapConfig, {}, params.format, params.layer, this);
        },
        function makeAdaptor(err, renderer){
            if ( err ) throw err;
            return new PlainRenderer.adaptor(renderer);
        },
        function returnCallback(err, renderer){
            callback(err, renderer);
        }
    );
};

RendererFactory.prototype.makeRendererBlend = function(params, mapConfig, callback) {
    var self = this;

    if ( ! params.token ) {
        callback(new Error("Blend renderer can only be initialized with map token"));
        return;
    }

    Step(
        function initRenderer() {
            self.blendRendererFactory.getRenderer(mapConfig, params, 'png', null, this);
        },
        function makeAdaptor(err, renderer){
            if ( err ) throw err;
            return new BlendRenderer.adaptor(renderer);
        },
        function returnCallback(err, renderer){
            callback(err, renderer);
        }
    );
};
