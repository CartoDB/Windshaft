// caches Mapnik render objects, purging after 60 seconds of inactivity:
var   _                     = require('underscore')
    , CacheEntry            = require('../cache/cache_entry')
    , Step                  = require('step')
    , tilelive              = require('tilelive')
    , MapnikRenderer = require('./mapnik')
    , HttpRenderer = require('./http')
    , TorqueRenderer = require('./torque');

module.exports = function(options, mml_store, map_store, mapnik_opts, httpRendererFactory) {

    // Configure bases for cache keys suitable for string interpolation
    var baseKey   = "<%= dbname %>:<%= table %>:";
    var renderKey = baseKey + "<%= dbuser %>:<%= format %>:<%= geom_type %>:<%= sql %>:<%= layer %>:<%= interactivity %>:<%= style %>:<%= style_version %>";

    // Set default mapnik options
    mapnik_opts = _.defaults( mapnik_opts ? mapnik_opts : {}, {

      // Metatile is the number of tiles-per-side that are going
      // to be rendered at once. If all of them will be requested
      // we'd have saved time. If only one will be used, we'd have
      // wasted time.
      //
      // Defaults to 2 as of tilelive-mapnik@0.3.2
      //
      // We'll assume an average of a 4x4 viewport
      metatile: 4,

      // Buffer size is the tickness in pixel of a buffer
      // around the rendered (meta?)tile.
      //
      // This is important for labels and other marker that overlap tile boundaries.
      // Setting to 128 ensures no render artifacts.
      // 64 may have artifacts but is faster.
      // Less important if we can turn metatiling on.
      //
      // defaults to 128 as of tilelive-mapnik@0.3.2
      //
      bufferSize: 64
    });

    var torqueFactory = new TorqueRenderer.factory(); // TODO: specify options

    var me = {
        serial: 0,
        renderers: {},
        timeout: options.timeout || 60000,
        mapnik_opts: mapnik_opts,
        statsInterval: options.statsInterval || 60000
    };

    me.dumpStats = function() {
      var now = Date.now();
      var renderers = me.renderers;
      var timeout = me.timeout;
      var itemkeys = _.keys(renderers);
      console.log("RenderCache items " + itemkeys.length + " timeout " + timeout + " next gc in " + ( timeout - ( now - me.lastCacheClearRun ) ) );
      _.each(itemkeys, function(key){
        var item = renderers[key];
        console.log(" ItemKey " + key + " ttl " + ( timeout - item.timeSinceLastAccess(now) ) + " cb " + item.cache_buster );
      });
    };

    me.lastCacheClearRun = Date.now();
    me.cacheClearInterval = setInterval( function() {
      var now = Date.now();
      _.each(me.renderers, function(cache_entry, key) {
          if ( cache_entry.timeSinceLastAccess(now) > me.timeout ) {
            me.del(key);
          }
      });
      me.lastCacheClearRun = now;
    }, me.timeout );

    me.renderersStatsIntervalId = setInterval(function() {
        global.statsClient.gauge('windshaft.rendercache.count', _.keys(me.renderers).length);

        var poolStats = _.reduce(
            _.filter(me.renderers, function(cacheEntry) {
                return cacheEntry.renderer
                    && cacheEntry.renderer.constructor == MapnikRenderer.adaptor
                    && cacheEntry.renderer.renderer._pool;
            }),
            function(_poolStats, cacheEntry) {
                _poolStats.count += cacheEntry.renderer.renderer._pool.getPoolSize();
                _poolStats.unused += cacheEntry.renderer.renderer._pool.availableObjectsCount();
                _poolStats.waiting += cacheEntry.renderer.renderer._pool.waitingClientsCount();
                return _poolStats;
            },
            {
                count: 0,
                unused: 0,
                waiting: 0
            }
        );

        global.statsClient.gauge('windshaft.mapnik-pool.count', poolStats.count);
        global.statsClient.gauge('windshaft.mapnik-pool.unused', poolStats.unused);
        global.statsClient.gauge('windshaft.mapnik-pool.waiting', poolStats.waiting);
    }, me.statsInterval);

    // Create a string ID/key from a set of params
    me.createKey = function(params, base) {
        var opts =  _.extend({}, params); // as params is a weird arrayobj right here
        delete opts.x;
        delete opts.y;
        delete opts.z;
        delete opts.callback;
        if ( ! opts.table ) {
          opts.table = opts.token;
          // interactivity is encoded in token
          delete opts.interactivity;
        }
        _.defaults(opts, {
          dbname:'', dbuser:'', table:'',
          format:'', geom_type:'', sql:'',
          interactivity:'', layer:'', style:'', style_version:''
        });
        return _.template(base ? baseKey : renderKey, opts);
    };

    // If renderer cache entry exists at req-derived key, return it,
    // else generate a new one and save at key.
    //
    // Caches lifetime is driven by the timeout passed at RendererCache
    // construction time.
    //
    //
    // @param callback will be called with (err, renderer)
    //        If `err` is null the renderer should be
    //        ready for you to use (calling getTile or getGrid).
    //        Note that the object is a proxy to the actual TileStore
    //        so you won't get the whole TileLive interface available.
    //        If you need that, use the .get() function.        
    //        In order to reduce memory usage call renderer.release()
    //        when you're sure you won't need it anymore.
    //                 
    //
    me.getRenderer = function(req, callback) {

        var params = req.params;
        var cache_buster = this.getCacheBusterValue(params.cache_buster);

        // setup
        var key  = this.createKey(params);

        var cache_entry = this.renderers[key];

        if (this.shouldRecreateRenderer(cache_entry, cache_buster)) {

            cache_entry = this.renderers[key] = new CacheEntry();
            cache_entry.cache_buster = cache_buster;
            cache_entry.key = key; // TODO: drop, is unused
            cache_entry._addRef(); // we add another ref for this.renderers[key]

            var that = this;

            cache_entry.on('error', function(err) {
              console.log("Removing RendererCache " + key + " on error " + err);
              that.del(key);
            });

            Step(
              function invokeHook () {
                if ( ! params.processRendererCache ) return true;
                params.processRendererCache(cache_entry, req, this);
              },
              function makeRenderer (err) {
                if ( err ) { callback(err); return; }
                that.makeRenderer(req, function(err, renderer) {
                  if (!err && req.profiler) {
                      req.profiler.done('makeRenderer-'+req.params.format.replace('.','_'));
                  }
                  cache_entry.setReady(err, renderer);
                });
              }
            );
        }

        cache_entry.pushCallback(callback);
    };

    me.getCacheBusterValue = function(cache_buster) {
        if (_.isUndefined(cache_buster)) {
            return 0;
        }
        if (_.isNumber(cache_buster)) {
            return Math.min(this._getMaxCacheBusterValue(), cache_buster);
        }
        return cache_buster;
    };

    me._getMaxCacheBusterValue = function() {
        return Date.now();
    };

    me.shouldRecreateRenderer = function(cacheEntry, cacheBuster) {
        if (cacheEntry) {
            var entryCacheBuster = parseFloat(cacheEntry.cache_buster),
                requestCacheBuster = parseFloat(cacheBuster);

            if (isNaN(entryCacheBuster) || isNaN(requestCacheBuster)) {
                return cacheEntry.cache_buster != cacheBuster;
            }
            return requestCacheBuster > entryCacheBuster;
        }
        return true;
    };

    me.dbParamsFromReqParams = function(params) {
        var dbParams = {};
        if ( params.dbuser ) dbParams.user = params.dbuser;
        if ( params.dbpassword ) dbParams.pass = params.dbpassword;
        if ( params.dbhost ) dbParams.host = params.dbhost;
        if ( params.dbport ) dbParams.port = params.dbport;
        if ( params.dbname ) dbParams.dbname = params.dbname;
        return dbParams;
    };

    var mapnikFactory = new MapnikRenderer.factory(mml_store, {
        mapnik_opts: mapnik_opts,
        createKeyFn: me.createKey
    });

    // controls the instantiation of mapnik renderer objects from mapnik XML
    me.makeRendererMapnik = function(req, callback){
        var params = _.extend({}, req.params);

        // returns a tilelive renderer by:
        // 1. generating or retrieving mapnik XML
        // 2. configuring a full mml document with mapnik XML, interactivity and other elements set
        Step(
            function getConfig(){
                if ( ! params.token ) return null;
                map_store.load(params.token, this);
            },
            function initRenderer(err, mapConfig) {
                if (err) throw err;
                mapnikFactory.getRenderer(mapConfig, params, params.format, params.layer, this);
            },
            function makeAdaptor(err, source){
                if (!err && req.profiler) {
                    req.profiler.done('tilelive-load');
                }
                if ( err ) throw err;
                return new MapnikRenderer.adaptor(source, params.format);
            },
            function returnCallback(err, source){
                callback(err, source);
            }
        );
    };

    // controls the instantiation of mapnik renderer objects from mapnik XML
    me.makeRendererTorque = function(req, callback){
        var that = this;
        var params = _.extend({}, req.params);
        if ( ! params.token || ! params.hasOwnProperty('layer') ) {
          callback(new Error("Torque renderer can only be initialized with map token and layer id"));
          return;
        }

        Step(
            function getConfig(){
              map_store.load(params.token, this);
            },
            function initRenderer(err, mapConfig) {
              if (err) throw err;
              var dbParams = that.dbParamsFromReqParams(params);
              var format = params.format;
              var layer = params.layer;
              torqueFactory.getRenderer(mapConfig.obj(), dbParams, format, layer, this);
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

    me.makeRendererHttp = function(req, callback) {
        var params = _.extend({}, req.params);
        if ( ! params.token || ! params.hasOwnProperty('layer') ) {
            callback(new Error("Torque renderer can only be initialized with map token and layer id"));
            return;
        }

        Step(
            function getConfig(){
                map_store.load(params.token, this);
            },
            function initRenderer(err, mapConfig) {
                if (err) throw err;
                httpRendererFactory.getRenderer(mapConfig, {}, params.format, params.layer, this);
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

    me.makeRenderer = function(req, callback){
      var params = req.params;
      if ( params.layer === 'all' ) {
        callback(Error("Not implemented"))
      }
      else if ( params.format.match(/^(png|grid\.json)$/) ) {
        me.makeRendererMapnik(req, callback);
      }
      else if ( params.format.match(/torque/) ) {
        me.makeRendererTorque(req, callback);
      }
      else if ( params.format.match(/http/) ) {
        me.makeRendererHttp(req, callback);
      }
      else {
        callback(new Error("Unsupported format " + params.format));
      }
    };


    // delete all renderers in cache
    me.purge = function(){
        var that = this;
        _.each(_.keys(that.renderers), function(key){
            that.del(key);
        });
    };


    // Clears out all renderers related to a given table, regardless of other arguments
    me.reset = function(req){
        var base_key = this.createKey(req.params, true); 
        var regex = new RegExp('^' + base_key + '.*');
        var that = this;

        _.each(_.keys(this.renderers), function(key){
            if(key.match(regex)){
                that.del(key);
            }
        });
    };


    // drain render pools, remove renderer and associated timeout calls
    me.del = function(id){
        var cache_entry = this.renderers[id];
        delete this.renderers[id];
        cache_entry.release();
    };


    return me;
};
