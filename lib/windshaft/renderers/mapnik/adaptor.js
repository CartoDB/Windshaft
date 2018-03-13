var wrap = require('../base_adaptor').wrap;

function parseSetupTimeMetric(stats = {}) {
    const setup = (stats.Mapnik.Setup || {})['Time (us)'];
    if (setup) {
        stats.Mk_Setup = setup / 1000;
    }
}

function parseRenderTimeMetric(stats = {}) {
    const render = (stats.Mapnik.Render || {})['Time (us)'];
    if (render) {
        stats.Mk_Render = render / 1000;
    }
}

function parseFeatureNumberMetric(stats = {}) {
    const features = ((stats.Mapnik.Render || {}).Style || {}).features;
    if (features) {
        stats.Mk_FeatNum = features;
    }
}

function parseMapnikMetrics(stats) {
    if (stats && stats.hasOwnProperty('Mapnik')) {
        parseSetupTimeMetric(stats);
        parseRenderTimeMetric(stats);
        parseFeatureNumberMetric(stats);

        delete stats.Mapnik;
    }
}

function TileliveAdaptor(renderer, format, onTileErrorStrategy) {
    this.renderer = renderer;
    this.close = this.renderer.close.bind(this.renderer);
    this.get = function() { return renderer; };
    if ( format === 'png' || format === 'png32' ) {
        if (onTileErrorStrategy) {
            this.getTile = function(z, x, y, callback) {
                renderer.getTile(z, wrap(x, z), y, function(err, tile, headers, stats) {
                    parseMapnikMetrics(stats);
                    if (err) {
                        return onTileErrorStrategy(err, tile, headers, stats, format, callback);
                    } else {
                        return callback(err, tile, headers, stats);
                    }
                });
            };
        } else {
            this.getTile = function(z, x, y, callback) {
                renderer.getTile(z, wrap(x, z), y, function(err, tile, headers, stats) {
                    parseMapnikMetrics(stats);
                    callback(err, tile, headers, stats);
                });
            };
        }
    } else if ( format === 'grid.json' ) {
        this.getTile = function(z, x, y, callback) {
            renderer.getGrid(z, wrap(x, z), y, function(err, tile, headers, stats) {
                parseMapnikMetrics(stats);
                callback(err, tile, headers, stats);
            });
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
