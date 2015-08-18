var blend = require('mapnik').blend;
var queue = require('queue-async');
var Timer = require('../../stats/timer');
var _ = require('underscore');

function Renderer(renderers) {
    this.renderers = renderers;
}

module.exports = Renderer;


Renderer.prototype.getTile = function(z, x, y, callback) {

    if (this.renderers.length === 1) {
        return this.renderers[0].getTile(z, x, y, callback);
    }

    var tileQueue = queue(this.renderers.length);

    var timer = new Timer();

    this.renderers.forEach(function(renderer) {
        tileQueue.defer(function (z, x, y, done) {
            var cb = function (err, buffer, headers, stats) {
                if (err) {
                    return done(err);
                }
                done(err, {
                    buffer: buffer,
                    headers: headers,
                    stats: stats,
                    x: 0,
                    y: 0,
                    reencode: true
                });
            };
            renderer.getTile(z, x, y, cb);
        }, z, x, y);
    });

    function tileQueueFinish(err, data) {
        timer.end('render');
        if (err) {
            return callback(err);
        }
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
        }, function(err, buffer) {
            timer.end('encode');
            if (err) {
                return callback(err);
            }
            callback(null, buffer, {'Content-Type': 'image/png'}, _.extend(timer.getTimes(), {r: extraStats}));
        });
    }

    timer.start('render');
    tileQueue.awaitAll(tileQueueFinish);
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

            rendererStats.cache.pngBufferSize += stats.cache.pngBufferSize;
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
                pngBufferSize: 0,
                png: 0,
                grid: 0
            }
        }
    );
};
