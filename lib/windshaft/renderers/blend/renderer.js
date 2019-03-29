'use strict';

var blend = require('@carto/mapnik').blend;
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
    let errored = false;

    this.renderers.forEach(function(renderer) {
        tileQueue.defer(function (z, x, y, done) {
            var cb = function (err, buffer, headers, stats) {
                // FIXME: Under hidden circustances `done` migth throw an error
                // when somenthing behind `getTile` isn't behaving as
                // queue-async expects. For instance, when renderer (torque-png) is not able
                // to download a marker (Couldn't get marker-file http://...svg)
                // This should be fixed properly by stopping of using async-queue and follow
                // the standards like Promises. Besides, we will need to review the error-handling in
                // Torque::PngRenderer to understand better why this is happening
                try {
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
                } catch (e) {
                    // avoid to callback twice
                    if (errored === false) {
                        errored = true;
                        return tileQueueFinish(new Error(
                            `Renderer: ${renderer.renderer.getName()}: couldn't render tile ${z}/${x}/${y}`
                        ));
                    }
                }
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
