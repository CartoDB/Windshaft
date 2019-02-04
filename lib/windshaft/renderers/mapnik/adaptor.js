'use strict';

var wrap = require('../base_adaptor').wrap;

const METRIC_PREFIX = "Mk_";

function parseMapnikMetrics(stats) {
    if (stats && stats.hasOwnProperty('Mapnik')) {

        Object.keys(stats.Mapnik).forEach(function(key) {
            var metric = stats.Mapnik[key];
            if (metric.constructor === Object) {
                if (metric.hasOwnProperty('Time (us)')) {
                    stats[METRIC_PREFIX + key] = Math.floor(metric['Time (us)'] / 1000);
                }
            } else {
                stats[METRIC_PREFIX + key] = metric;
            }
        });

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
                count: renderer._pool.size,
                unused: renderer._pool.available,
                // borrowed: renderer._pool.borrowed,
                waiting: renderer._pool.pending
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
