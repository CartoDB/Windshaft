// caches Mapnik render objects, purging after 60 seconds of inactivity:
var _                     = require('underscore');
var CacheEntry            = require('../cache/cache_entry');
var Step                  = require('step');
var RendererParams        = require('./renderer_params');
var MapnikRenderer        = require('./mapnik');
var tilelive              = require('tilelive');


module.exports = function(options, mml_store, map_store, mapnik_opts, rendererFactory) {

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
                return cacheEntry.renderer &&
                    cacheEntry.renderer.constructor == MapnikRenderer.adaptor &&
                    cacheEntry.renderer.renderer._pool;
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
        var key = RendererParams.createKey(params);

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
              function getConfig(err) {
                  if ( err ) { callback(err); return; }
                  if ( ! params.token ) return null;
                  map_store.load(params.token, this);
              },
              function makeRenderer (err, mapConfig) {
                if ( err ) {
                    that.del(key);
                    return callback(err);
                }
                rendererFactory.makeRenderer(mapConfig, _.extend({}, req.params), function(err, renderer) {
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


    // delete all renderers in cache
    me.purge = function(){
        var that = this;
        _.each(_.keys(that.renderers), function(key){
            that.del(key);
        });
    };


    // Clears out all renderers related to a given table, regardless of other arguments
    me.reset = function(req){
        var base_key = RendererParams.createKey(req.params, true);
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
