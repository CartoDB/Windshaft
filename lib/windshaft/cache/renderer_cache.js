// Current {RendererCache} responsibilities:
//  - Caches (adapted) renderer objects
//  - Purges the renderer objects after `{Number} options.timeout` ms of inactivity since the last cache entry access
//    Renderer objects are encapsulated inside a {CacheEntry} that tracks the last access time for each renderer
var _ = require('underscore');
var CacheEntry = require('./cache_entry');
var step = require('step');


function RendererCache(rendererFactory, options) {
    options = options || {};

    this.renderers = {};
    this.timeout = options.timeout || 60000;

    this.rendererFactory = rendererFactory;

    setInterval(function () {
        var now = Date.now();
        _.each(this.renderers, function (cacheEntry, key) {
            if (cacheEntry.timeSinceLastAccess(now) > this.timeout) {
                this.del(key);
            }
        }.bind(this));
    }.bind(this), this.timeout);
}

module.exports = RendererCache;

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
RendererCache.prototype.getRenderer = function(mapConfigProvider, callback) {

    var cacheBuster = this.getCacheBusterValue(mapConfigProvider.getCacheBuster());

    // setup
    var key = mapConfigProvider.getKey();

    var cacheEntry = this.renderers[key];

    if (this.shouldRecreateRenderer(cacheEntry, cacheBuster)) {

        cacheEntry = this.renderers[key] = new CacheEntry(cacheBuster);
        cacheEntry._addRef(); // we add another ref for this.renderers[key]

        var self = this;

        cacheEntry.on('error', function(err) {
            console.log("Removing RendererCache " + key + " on error " + err);
            self.del(key);
        });

        step(
            function getConfig() {
                mapConfigProvider.getMapConfig(this);
            },
            function makeRenderer (err, mapConfig, params, context) {
                if (err) {
                    self.del(key);
                    return callback(err);
                }
                self.rendererFactory.getRenderer(mapConfig, params, context, cacheEntry.setReady.bind(cacheEntry));
            }
        );
    }

    cacheEntry.pushCallback(callback);
};

RendererCache.prototype.getCacheBusterValue = function(cache_buster) {
    if (_.isUndefined(cache_buster)) {
        return 0;
    }
    if (_.isNumber(cache_buster)) {
        return Math.min(this._getMaxCacheBusterValue(), cache_buster);
    }
    return cache_buster;
};

RendererCache.prototype._getMaxCacheBusterValue = function() {
    return Date.now();
};

RendererCache.prototype.shouldRecreateRenderer = function(cacheEntry, cacheBuster) {
    if (cacheEntry) {
        var entryCacheBuster = parseFloat(cacheEntry.cacheBuster),
            requestCacheBuster = parseFloat(cacheBuster);

        if (isNaN(entryCacheBuster) || isNaN(requestCacheBuster)) {
            return cacheEntry.cacheBuster !== cacheBuster;
        }
        return requestCacheBuster > entryCacheBuster;
    }
    return true;
};


// delete all renderers in cache
RendererCache.prototype.purge = function(){
    var that = this;
    _.each(_.keys(that.renderers), function(key){
        that.del(key);
    });
};


// Clears out all renderers related to a given database+token, regardless of other arguments
RendererCache.prototype.reset = function(mapConfigProvider) {
    var self = this;

    _.each(_.keys(this.renderers), function(key){
        if(mapConfigProvider.filter(key)){
            self.del(key);
        }
    });
};


// drain render pools, remove renderer and associated timeout calls
RendererCache.prototype.del = function(id){
    var cache_entry = this.renderers[id];
    delete this.renderers[id];
    cache_entry.release();
};
