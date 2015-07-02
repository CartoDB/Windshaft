//  - Reports stats about:
//    * Total number of renderers
//    * For mapnik renderers:
//      - the mapnik-pool status: count, unused and waiting
//      - the internally cached objects: png and grid

var _ = require('underscore');
var MapnikRenderer = require('../../renderers/mapnik');

function RendererStatsReporter(rendererCache, statsInterval) {
    this.rendererCache = rendererCache;
    this.statsInterval = statsInterval || 6e4;
    this.renderersStatsIntervalId = null;
}

module.exports = RendererStatsReporter;

RendererStatsReporter.prototype.start = function() {
    var self = this;
    this.renderersStatsIntervalId = setInterval(function() {
        var rendererCacheEntries = self.rendererCache.renderers;

        if (!rendererCacheEntries) {
            return null;
        }

        global.statsClient.gauge('windshaft.rendercache.count', _.keys(rendererCacheEntries).length);

        var renderersStats = _.filter(rendererCacheEntries, function(cacheEntry) {
            return cacheEntry.renderer && cacheEntry.renderer.constructor === MapnikRenderer.adaptor &&
                cacheEntry.renderer.renderer._pool;
        }).reduce(
            function(_rendererStats, cacheEntry) {
                if (cacheEntry.renderer.renderer._pool) {
                    _rendererStats.pool.count += cacheEntry.renderer.renderer._pool.getPoolSize();
                    _rendererStats.pool.unused += cacheEntry.renderer.renderer._pool.availableObjectsCount();
                    _rendererStats.pool.waiting += cacheEntry.renderer.renderer._pool.waitingClientsCount();
                }

                if (cacheEntry.renderer.renderer._tileCache && cacheEntry.renderer.renderer._tileCache.results) {
                    _rendererStats.cache = Object.keys(cacheEntry.renderer.renderer._tileCache.results).reduce(
                        function(cacheStats, key) {
                            if (key.match(/^utf/)) {
                                cacheStats.grid += 1;
                            } else {
                                cacheStats.png += 1;
                                var buf = cacheEntry.renderer.renderer._tileCache.results[key][1];
                                if (buf) {
                                    cacheStats.pngBufferSize += buf.length || 0;
                                }
                            }
                            return cacheStats;
                        },
                        _rendererStats.cache
                    );
                }

                return _rendererStats;
            },
            {
                pool: {
                    count: 0,
                    unused: 0,
                    waiting: 0
                },
                cache: {
                    pngBufferSize: 0,
                    png: 0,
                    grid: 0
                }
            }
        );

        global.statsClient.gauge('windshaft.mapnik-cache.png', renderersStats.cache.png);
        global.statsClient.gauge('windshaft.mapnik-cache.png-size', renderersStats.cache.pngBufferSize);
        global.statsClient.gauge('windshaft.mapnik-cache.grid', renderersStats.cache.grid);

        global.statsClient.gauge('windshaft.mapnik-pool.count', renderersStats.pool.count);
        global.statsClient.gauge('windshaft.mapnik-pool.unused', renderersStats.pool.unused);
        global.statsClient.gauge('windshaft.mapnik-pool.waiting', renderersStats.pool.waiting);
    }, this.statsInterval);

};


RendererStatsReporter.prototype.stop = function() {
    clearInterval(this.renderersStatsIntervalId);
    this.renderersStatsIntervalId = null;
};
