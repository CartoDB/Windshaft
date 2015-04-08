var blend = require('mapnik').blend;
var queue = require('queue-async');
var Timer = require('../../stats/timer');
var _ = require('underscore');

function Renderer(getTiles) {
    this.getTiles = getTiles;
}

module.exports = Renderer;


Renderer.prototype.getTile = function(z, x, y, callback) {
    var tileQueue = queue(this.getTiles.length);

    var timer = new Timer();

    this.getTiles.forEach(function(getTile) {
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
            getTile(z, x, y, cb);
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
