var wrap = require('../base_adaptor').wrap;

function TileliveAdaptor(renderer, format, onTileErrorStrategy) {
    this.renderer = renderer;
    this.close = this.renderer.close.bind(this.renderer);
    this.get = function() { return renderer; };
    if ( format === 'png' || format === 'png32' ) {
        if (onTileErrorStrategy) {
            this.getTile = function(z, x, y, options, callback) {
                renderer.getTile(z, wrap(x, z), y, options, function(err, tile, headers, stats, requestId) {
                    if (err) {
                        return onTileErrorStrategy(err, tile, headers, stats, format, requestId, callback);
                    } else {
                        return callback(err, tile, headers, stats, requestId);
                    }
                });
            };
        } else {
            this.getTile = function(z, x, y, options, callback) {
                renderer.getTile(z, wrap(x, z), y, options, callback);
            };
        }
    } else if ( format === 'grid.json' ) {
        this.getTile = function(z, x, y, options, callback) {
            renderer.getGrid(z, wrap(x, z), y, options, callback);
        };
    } else {
        throw new Error("Unsupported format " + format);
    }
    this.getMetadata = function(callback) {
        return callback(null, {});
    };
    this.getStats = function() {
        return {
            pool: {
                count: renderer._pool.getPoolSize(),
                unused: renderer._pool.availableObjectsCount(),
                waiting: renderer._pool.waitingClientsCount()
            },
            cache: Object.keys(renderer._tileCache.results).reduce(
                function(cacheStats, key) {
                    if (key.match(/^utf/)) {
                        cacheStats.grid += 1;
                    } else {
                        cacheStats.png += 1;
                    }
                    return cacheStats;
                },
                {
                    png: 0,
                    grid: 0
                }
            )
        };
    };
}

module.exports = TileliveAdaptor;
