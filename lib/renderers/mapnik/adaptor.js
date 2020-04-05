'use strict';

const BaseAdaptor = require('../base-adaptor');

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

module.exports = class MapnikAdaptor extends BaseAdaptor {
    async getTile (format, z, x, y) {
        if (format === 'grid.json') {
            format = 'utf';
        }
        const { buffer, headers, stats } = await super.getTile(format, z, x, y);
        parseMapnikMetrics(stats);
        return { buffer, headers, stats };
    }

    getStats () {
        const stats = this.renderer.getStats();

        if (stats.has('cache.utf')) {
            stats.set('cache.grid', stats.get('cache.utf'));
            stats.delete('cache.utf');
        }

        return stats;
    }
};
