'use strict';

var blend = require('@carto/mapnik').blend;
var Timer = require('../../stats/timer');

function Renderer(renderers) {
    this.renderers = renderers;
}

module.exports = Renderer;

Renderer.prototype.getTile = function(z, x, y, callback) {
    if (!this.renderers.length) {
        return callback(new Error('No renderers'));
    }

    if (this.renderers.length === 1) {
        return this.renderers[0].getTile(z, x, y, callback);
    }

    const timer = new Timer();

    timer.start('render');
    return Promise.all(this.renderers.map(renderer => {
        return new Promise((resolve, reject) => {
            renderer.getTile(z, x, y, (err, buffer, headers, stats) => {
                if (err) {
                    return reject(err);
                }

                resolve({
                    buffer: buffer,
                    headers: headers,
                    stats: stats,
                    x: 0,
                    y: 0,
                    reencode: true
                });
            });
        });
    }))
    .then(data => {
        timer.end('render');

        if (!data) {
            return callback(new Error('No tiles to stitch.'));
        }

        var extraStats = [];
        data.forEach(function(d){
            extraStats.push(d.stats);
        });

        timer.start('encode');
        blend(data, {
            format: 'png',
            quality: null,
            width: 256,
            height: 256,
            reencode: true
        }, function (err, buffer) {
            timer.end('encode');
            if (err) {
                return callback(err);
            }
            callback(null, buffer, {'Content-Type': 'image/png'}, Object.assign(timer.getTimes(), {r: extraStats}));
        });
    })
    .catch(err => {
        timer.end('render');
        return callback(err);
    });
};

Renderer.prototype.getMetadata = function(callback) {
    return callback(null, {});
};

Renderer.prototype.getStats = function() {
    return this.renderers.reduce(
        function(rendererStats, renderer) {
            var stats = renderer.getStats();

            rendererStats.pool.count += stats.pool.count;
            rendererStats.pool.unused += stats.pool.unused;
            rendererStats.pool.waiting += stats.pool.waiting;

            rendererStats.cache.png += stats.cache.png;
            rendererStats.cache.grid += stats.cache.grid;

            return rendererStats;
        },
        {
            pool: {
                count: 0,
                unused: 0,
                waiting: 0
            },
            cache: {
                png: 0,
                grid: 0
            }
        }
    );
};

Renderer.prototype.close = function(callback) {
    this.renderers.forEach(function(renderer) {
        renderer.close(callback);
    });
};
