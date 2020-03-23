'use strict';

// Current {RendererCache} responsibilities:
//  - Caches (adapted) renderer objects
//  - Purges the renderer objects after `{Number} options.timeout` ms of inactivity since the last cache entry access
//    Renderer objects are encapsulated inside a {CacheEntry} that tracks the last access time for each renderer

var EventEmitter = require('events').EventEmitter;
var util = require('util');
var CacheEntry = require('./cache-entry');
var debug = require('debug')('windshaft:renderercache');

function RendererCache (rendererFactory, options) {
    if (!(this instanceof RendererCache)) {
        return new RendererCache(rendererFactory, options);
    }

    EventEmitter.call(this);

    options = options || {};

    this.renderers = {};
    this.timeout = options.timeout || options.ttl || 60000;

    this.gcRun = 0;

    this.rendererFactory = rendererFactory;

    setInterval(function () {
        var now = Date.now();
        Object.keys(this.renderers).forEach(function (key) {
            var cacheEntry = this.renderers[key];
            if (cacheEntry.timeSinceLastAccess(now) > this.timeout) {
                this.del(key);
            }
        }.bind(this));
    }.bind(this), this.timeout);
}

util.inherits(RendererCache, EventEmitter);

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
RendererCache.prototype.getRenderer = function (mapConfigProvider, callback) {
    var cacheBuster = this.getCacheBusterValue(mapConfigProvider.getCacheBuster());

    // setup
    var key = mapConfigProvider.getKey();

    var cacheEntry = this.renderers[key];

    if (this.shouldRecreateRenderer(cacheEntry, cacheBuster)) {
        cacheEntry = this.renderers[key] = new CacheEntry(cacheBuster, key);
        cacheEntry._addRef(); // we add another ref for this.renderers[key]

        var self = this;

        cacheEntry.on('error', function (err) {
            debug('Removing RendererCache ' + key + ' on error ' + err);
            self.emit('err', err);
            self.del(key);
        });

        mapConfigProvider.getMapConfig(function makeRenderer (err, mapConfig, params, context) {
            if (err) {
                self.del(key);
                return callback(err);
            }
            self.rendererFactory.getRenderer(mapConfig, params, context, cacheEntry.setReady.bind(cacheEntry));
        });
    }

    cacheEntry.pushCallback(callback);
};

RendererCache.prototype.getCacheBusterValue = function (cacheBuster) {
    if (cacheBuster === undefined) {
        return 0;
    }
    if (Number.isFinite(cacheBuster)) {
        return Math.min(this._getMaxCacheBusterValue(), cacheBuster);
    }
    return cacheBuster;
};

RendererCache.prototype._getMaxCacheBusterValue = function () {
    return Date.now();
};

RendererCache.prototype.shouldRecreateRenderer = function (cacheEntry, cacheBuster) {
    if (cacheEntry) {
        var entryCacheBuster = parseFloat(cacheEntry.cacheBuster);
        var requestCacheBuster = parseFloat(cacheBuster);

        if (isNaN(entryCacheBuster) || isNaN(requestCacheBuster)) {
            return cacheEntry.cacheBuster !== cacheBuster;
        }
        return requestCacheBuster > entryCacheBuster;
    }
    return true;
};

// delete all renderers in cache
RendererCache.prototype.purge = function () {
    Object.keys(this.renderers).forEach(this.del.bind(this));
};

// Clears out all renderers related to a given database+token, regardless of other arguments
RendererCache.prototype.reset = function (mapConfigProvider) {
    Object.keys(this.renderers)
        .filter(mapConfigProvider.filter.bind(mapConfigProvider))
        .forEach(this.del.bind(this));
};

// drain render pools, remove renderer and associated timeout calls
RendererCache.prototype.del = function (id) {
    var cacheEntry = this.renderers[id];
    if (cacheEntry) {
        delete this.renderers[id];
        cacheEntry.release();
    }
};

RendererCache.prototype.getStats = function () {
    const stats = new Map();
    const rendererCacheEntries = Object.entries(this.renderers);

    stats.set('rendercache.count', rendererCacheEntries.length);

    return rendererCacheEntries.reduce((accumulatedStats, [cacheKey, cacheEntry]) => {
        let format = cacheKey.split(':')[3]; // [dbname, token, dbuser, format, layer, scale]

        format = format === '' ? 'no-format' : format;
        format = format === 'grid.json' ? 'grid' : format.replace('.', '-');

        const key = `rendercache.format.${format}`;

        if (accumulatedStats.has(key)) {
            accumulatedStats.set(key, accumulatedStats.get(key) + 1);
        } else {
            accumulatedStats.set(key, 1);
        }

        // it might a cacheEntry has been released & removed from the cache during this process
        const rendererStats = cacheEntry.renderer && cacheEntry.renderer.getStats && cacheEntry.renderer.getStats();

        if (!(rendererStats instanceof Map)) {
            return accumulatedStats;
        }

        for (const [stat, value] of rendererStats) {
            if (accumulatedStats.has(stat)) {
                accumulatedStats.set(stat, accumulatedStats.get(stat) + value);
            } else {
                accumulatedStats.set(stat, value);
            }
        }

        return accumulatedStats;
    }, stats);
};
