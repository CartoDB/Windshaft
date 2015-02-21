var blend = require('mapnik').blend;
var queue = require('queue-async');

function Renderer(getTiles) {
    this.getTiles = getTiles;
}

module.exports = Renderer;


Renderer.prototype.getTile = function(z, x, y, callback) {
    var tileQueue = queue(this.getTiles.length);

    this.getTiles.forEach(function(getTile) {
        tileQueue.defer(function (z, x, y, done) {
            var cb = function (err, buffer, headers) {
                if (err) {
                    return done(err);
                }
                done(err, {
                    buffer: buffer,
                    headers: headers,
                    x: 0,
                    y: 0,
                    reencode: true
                });
            };
            getTile(z, x, y, cb);
        }, z, x, y);
    });

    function tileQueueFinish(err, data) {
        if (err) {
            return callback(err);
        }
        if (!data) {
            return callback(new Error('No tiles to stitch.'));
        }
        var headers = [];
        data.forEach(function(d){
            headers.push(d.headers);
        });

        blend(data, {
            format: 'png',
            quality: null,
            width: 256,
            height: 256,
            reencode: true
        }, function(err, buffer) {
            if (err) {
                return callback(err);
            }
            callback(null, buffer, {'Content-Type': 'image/png'});
        });
    }

    tileQueue.awaitAll(tileQueueFinish);
};
