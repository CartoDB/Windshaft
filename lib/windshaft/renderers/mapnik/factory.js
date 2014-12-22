var tilelive = require('tilelive');
var Step = require('step');
var _ = require('underscore');

require('tilelive-mapnik').registerProtocols(tilelive);

function MapnikFactory(mmlStore, options) {
    this._mmlStore = mmlStore;
    this._options = options;
}

module.exports = MapnikFactory;


MapnikFactory.prototype.getRenderer = function(mapConfig, params, format, layer, callback) {
    var self = this;
    var mml_builder;

    if ( params.token ) {
        delete params.interactivity; // will be rewritten from MapConfig
        params = _.defaults(params, this.mapConfigToMMLBuilderConfig(mapConfig));
        delete params.token;
    }

    Step(
        function initBuilder() {
            // create an mapnik mml builder object
            mml_builder = self._mmlStore.mml_builder(params, this);
        },
        function generateXML(err){
            if (err) throw err;
            mml_builder.toXML(this);
        },
        function loadMapnik(err, data){
//            if (!err && req.profiler) {
//                req.profiler.done('generateXML');
//            }

            if (err) throw err;

            var query = {
                // TODO: document what `base` is
                base: self._options.createKeyFn(params) + '/xia',
                metatile: self._options.mapnik_opts.metatile,
                bufferSize: self._options.mapnik_opts.bufferSize,
                autoLoadFonts: false,
                internal_cache: false
            };

            // build full document to pass to tilelive
            var uri = {
                query: query,
                protocol: 'mapnik:',
                slashes: true,
                xml: data,
                strict: !!params.strict, // force boolean
                mml: {
                    format: params.format // this seems to be useless
                }
            };

            // hand off to tilelive to create a renderer
            tilelive.load(uri, this);
        },
        function returnCallback(err, source) {
            callback(err, source)
        }
    );
};

MapnikFactory.prototype.mapConfigToMMLBuilderConfig = function(mapConfig) {
    var cfg = mapConfig.obj();
    var sql = [];
    var style = [];
    var geom_columns = [];
    var extra_ds_opts = [];
    var interactivity = [];
    var style_version = [];
    for ( var i=0; i<cfg.layers.length; ++i ) {
        var lyr = cfg.layers[i];
        if ( mapConfig.layerType(i) != 'mapnik' ) continue;
        if ( ! lyr.hasOwnProperty('options') )
            throw new Error("Missing options from layer " + i + " of layergroup config");
        var lyropt = lyr.options;
        if ( ! lyropt.hasOwnProperty('sql') )
            throw new Error("Missing sql for layer " + i + " options");
        // Wrap SQL requests in mapnik format if sent
        sql.push( "(" + lyropt.sql.replace(/;\s*$/, '') + ") as cdbq");
        if ( ! lyropt.hasOwnProperty('cartocss') )
            throw new Error("Missing cartocss for layer " + i + " options");
        style.push(lyropt.cartocss);
        if ( ! lyropt.hasOwnProperty('cartocss_version') ) {
            throw new Error("Missing cartocss_version for layer " + i + " options");
        }
        style_version.push(lyropt.cartocss_version);
        // NOTE: interactivity used to be a string as of version 1.0.0
        if ( _.isArray(lyropt.interactivity) ) {
            lyropt.interactivity = lyropt.interactivity.join(',');
        }
        interactivity.push(lyropt.interactivity);
        if (lyropt['geom_column']) {
            geom_columns[i] = {
                type: lyropt['geom_type'], // possibly undefined, grainstore allows it
                name: lyropt['geom_column']
            };
        }
        extra_opt = {};
        if ( lyropt.hasOwnProperty('raster_band') ) {
            extra_opt['band'] = lyropt['raster_band'];
        }
        extra_ds_opts.push( extra_opt );
    }
    if ( ! sql.length ) throw new Error("No 'mapnik' layers in MapConfig");
    var opts = {
        sql: sql,
        style: style,
        style_version: style_version,
        interactivity: interactivity,
        ttl: 0,
        extra_ds_opts: extra_ds_opts
    };
    if (geom_columns.length) {
        opts.gcols = geom_columns;
    }

    return opts;
};
