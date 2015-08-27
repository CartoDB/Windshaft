// Current {RenderCache} responsibilities:
//  - Caches (adapted) renderer objects
//  - Purges the renderer objects after `{Number} options.timeout` ms of inactivity since the last cache entry access
//    Renderer objects are encapsulated inside a {CacheEntry} that tracks the last access time for each renderer
var _ = require('underscore');
var CacheEntry = require('../cache/cache_entry');
var step = require('step');
var RendererParams = require('./renderer_params');
var assert = require('assert');


module.exports = function(options, map_store, rendererFactory) {

    var me = {
        serial: 0,
        renderers: {},
        gcRun: 0,
        timeout: options.timeout || options.ttl || 60000
    };

    me.shouldRunGc = function() {
        if (++me.gcRun % 10 === 0) {
            me.gcRun = 0;
            return true;
        }
        return false;
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

        // node should run with `--expose_gc` flag to enable gc extension
        if (me.shouldRunGc() && global.gc) {
            var start = Date.now();
            global.gc();
            global.statsClient.timing('windshaft.rendercache.gc', Date.now() - start);
        }
    }, me.timeout );


    /**
     * @param req Request object that is triggering the renderer creation
     * @param callback Function to call with:
     *  - err Error in case something goes wrong
     *  - rendererOptions Object with different options for the renderer to be created
     *
     * @type {Function}
     */
    me.beforeRendererCreate = options.beforeRendererCreate || function(req, callback) {
        return callback(null, {});
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
        var key = RendererParams.createKey(params);

        var cache_entry = this.renderers[key];

        if (this.shouldRecreateRenderer(cache_entry, cache_buster)) {

            cache_entry = this.renderers[key] = new CacheEntry();
            cache_entry.cache_buster = cache_buster;
            cache_entry.key = key; // TODO: drop, is unused
            cache_entry._addRef(); // we add another ref for this.renderers[key]

            var self = this;

            cache_entry.on('error', function(err) {
              console.log("Removing RendererCache " + key + " on error " + err);
              self.del(key);
            });

            var context = {};
            step(
                function beforeMakeRenderer() {
                    me.beforeRendererCreate(req, this);
                },
                function handleRendererOptions(err, rendererOptions) {
                    assert.ifError(err);
                    context = rendererOptions;
                    return null;
                },
                function getConfig(err) {
                    assert.ifError(err);

                    if (!params.token) {
                        throw new Error("Layergroup `token` id is a required param");
                    }
                    map_store.load(params.token, this);
                },
                function makeRenderer (err, mapConfig) {
                    if (err) {
                        self.del(key);
                        return callback(err);
                    }
                    rendererFactory.getRenderer(mapConfig, _.extend({}, params), context, function (err, renderer) {
                        if (!err && req.profiler) {
                            req.profiler.done('makeRenderer-' + params.format.replace('.', '_'));
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
                return cacheEntry.cache_buster !== cacheBuster;
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


    // Clears out all renderers related to a given database+token, regardless of other arguments
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
