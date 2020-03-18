'use strict';

var wrap = require('../base-adaptor').wrap;

const METRIC_PREFIX = 'Mk_';

function parseMapnikMetrics (stats) {
    if (stats && Object.prototype.hasOwnProperty.call(stats, 'Mapnik')) {
        Object.keys(stats.Mapnik).forEach(function (key) {
            var metric = stats.Mapnik[key];
            if (metric.constructor === Object) {
                if (Object.prototype.hasOwnProperty.call(metric, 'Time (us)')) {
                    stats[METRIC_PREFIX + key] = Math.floor(metric['Time (us)'] / 1000);
                }
            } else {
                stats[METRIC_PREFIX + key] = metric;
            }
        });

        delete stats.Mapnik;
    }
}

module.exports = class MapnikAdaptor {
    constructor (renderer, format, onTileErrorStrategy) {
        this.renderer = renderer;
        if (onTileErrorStrategy) {
            this.onTileErrorStrategy = function (err, tile, headers, stats, format) {
                return new Promise((resolve, reject) => {
                    onTileErrorStrategy(err, tile, headers, stats, format, (err, buffer, headers, stats) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve({ buffer, headers, stats });
                    });
                });
            };
        };
    }

    get () {
        return this.renderer;
    }

    async getTile (format, z, x, y) {
        try {
            if (format === 'grid.json') {
                format = 'utf';
            }
            const { buffer, headers, stats } = await this.renderer.getTile(format, z, wrap(x, z), y);
            parseMapnikMetrics(stats);
            return { buffer, headers, stats };
        } catch (err) {
            if (this.onTileErrorStrategy) {
                const [tile, headers, stats] = [null, {}, {}];
                return this.onTileErrorStrategy(err, tile, headers, stats, format);
            }
            throw err;
        }
    }

    async close () {
        await this.renderer.close();
    }

    async getMetadata () {
        return {};
    }

    getStats () {
        const cacheResults = this.renderer._metatileCache ? this.renderer._metatileCache.results : {};

        return {
            pool: {
                count: this.renderer._mapPool.size,
                unused: this.renderer._mapPool.available,
                waiting: this.renderer._mapPool.pending
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
    }
};
