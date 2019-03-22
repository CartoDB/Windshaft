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

    const _format = format === 'grid.json' ? 'utf' : format;

    this.getTile = function(z, x, y, callback) {
        renderer.getTile(_format, z, wrap(x, z), y, function(err, tile, headers, stats) {
            parseMapnikMetrics(stats);
            if (err && onTileErrorStrategy) {
                return onTileErrorStrategy(err, tile, headers, stats, format, callback);
            }

            return callback(err, tile, headers, stats);
        });
    };

    this.getMetadata = function(callback) {
        return callback(null, {});
    };
    this.getStats = function() {
        const cacheResults = !!renderer._metatileCache ? renderer._metatileCache.results : {};

        return {
            pool: {
                count: renderer._mapPool.size,
                unused: renderer._mapPool.available,
                // borrowed: renderer._mapPool.borrowed,
                waiting: renderer._mapPool.pending
            },
            cache: Object.keys(cacheResults).reduce((cacheStats, key) => {
                if (key.match(/^utf/)) {
                    cacheStats.grid += 1;
                } else {
                    cacheStats.png += 1;
                }

                return cacheStats;
            }, { png: 0, grid: 0 })
        };
    };
}

module.exports = TileliveAdaptor;
