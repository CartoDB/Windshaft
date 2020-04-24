'use strict';

// Current {RendererCache} responsibilities:
//  - Caches (adapted) renderer objects
//  - Purges the renderer objects after `{Number} options.timeout` ms of inactivity since the last cache entry access
//    Renderer objects are encapsulated inside a {CacheEntry} that tracks the last access time for each renderer

const { EventEmitter } = require('events');
const CacheEntry = require('./cache-entry');
const debug = require('debug')('windshaft:renderercache');

module.exports = class RendererCache extends EventEmitter {
    constructor (rendererFactory, options = {}) {
        super();

        this.renderers = {};
        this.timeout = options.timeout || options.ttl || 60000;
        this.gcRun = 0;
        this.rendererFactory = rendererFactory;

        setInterval(() => {
            const now = Date.now();
            for (const [key, cacheEntry] of Object.entries(this.renderers)) {
                if (cacheEntry.timeSinceLastAccess(now) > this.timeout) {
                    this.del(key);
                }
            }
        }, this.timeout);
    }

    // If renderer cache entry exists at req-derived key, return it,
    // else generate a new one and save at key.
    //
    // Caches lifetime is driven by the timeout passed at RendererCache
    // construction time.
    //
    // @param callback will be called with (err, renderer)
    //        If `err` is null the renderer should be
    //        ready for you to use (calling getTile or getGrid).
    //        Note that the object is a proxy to the actual TileStore
    //        so you won't get the whole TileLive interface available.
    //        If you need that, use the .get() function.
    //        In order to reduce memory usage call renderer.release()
    //        when you're sure you won't need it anymore.
    getRenderer (mapConfigProvider, callback) {
        const cacheBuster = this.getCacheBusterValue(mapConfigProvider.getCacheBuster());
        const key = mapConfigProvider.getKey();
        let cacheEntry = this.renderers[key];

        if (this.shouldRecreateRenderer(cacheEntry, cacheBuster)) {
            cacheEntry = this.renderers[key] = new CacheEntry(cacheBuster, key);
            cacheEntry._addRef(); // we add another ref for this.renderers[key]

            cacheEntry.on('error', (err) => {
                debug('Removing RendererCache ' + key + ' on error ' + err);
                this.emit('err', err);
                this.del(key);
            });

            mapConfigProvider.getMapConfig((err, mapConfig, params, context) => {
                if (err) {
                    this.del(key);
                    return callback(err);
                }

                this.rendererFactory.getRenderer(mapConfig, params, context, cacheEntry.setReady.bind(cacheEntry));
            });
        }

        cacheEntry.pushCallback(callback);
    };

    getCacheBusterValue (cacheBuster) {
        if (cacheBuster === undefined) {
            return 0;
        }

        if (Number.isFinite(cacheBuster)) {
            return Math.min(this._getMaxCacheBusterValue(), cacheBuster);
        }

        return cacheBuster;
    }

    _getMaxCacheBusterValue () {
        return Date.now();
    }

    shouldRecreateRenderer (cacheEntry, cacheBuster) {
        if (cacheEntry) {
            const entryCacheBuster = parseFloat(cacheEntry.cacheBuster);
            const requestCacheBuster = parseFloat(cacheBuster);

            if (isNaN(entryCacheBuster) || isNaN(requestCacheBuster)) {
                return cacheEntry.cacheBuster !== cacheBuster;
            }

            return requestCacheBuster > entryCacheBuster;
        }

        return true;
    }

    // delete all renderers in cache
    purge () {
        for (const key of Object.keys(this.renderers)) {
            this.del(key);
        }
    }

    // Clears out all renderers related to a given database+token, regardless of other arguments
    reset (mapConfigProvider) {
        for (const key of Object.keys(this.renderers)) {
            if (mapConfigProvider.filter(key)) {
                this.del(key);
            }
        }
    }

    // drain render pools, remove renderer and associated timeout calls
    del (id) {
        const cacheEntry = this.renderers[id];

        if (cacheEntry) {
            delete this.renderers[id];
            cacheEntry.release();
        }
    }

    getStats () {
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
    }
};
