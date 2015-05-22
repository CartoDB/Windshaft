var mapnik = require('mapnik');
var Timer = require('../../stats/timer');

function Renderer(color, options) {
    this.color = color || '#ffffff';

    this.options = options || {};
    this.options.tileSize = this.options.tileSize || 256;
    this.options.format = this.options.format || 'png8:m=h';

    this.cachedTile = null;
    this.callbacks = null;
}

module.exports = Renderer;

var PLAIN_IMAGE_HEADERS = { 'Content-Type': 'image/png' };


Renderer.prototype.getTile = function(z, x, y, callback) {
    var self = this;

    if (this.cachedTile !== null) {
        return callback(null, this.cachedTile, PLAIN_IMAGE_HEADERS, {});
    }


    function done(err, buffer, headers, stats) {
        self.cachedTile = buffer || null;
        self.callbacks.forEach(function(callback) {
            callback(err, buffer, headers, stats);
        });
    }

    if (this.callbacks === null) {
        this.callbacks = [];
        this.callbacks.push(callback);

        var timer = new Timer();

        timer.start('render');
        var image = new mapnik.Image(this.options.tileSize, this.options.tileSize);
        try {
            image.background = new mapnik.Color(this.color);
        } catch (err) {
            return done(new Error('Plain renderer: ' + err.message));
        }

        timer.start('encode');
        image.encode(this.options.format, function(err, buffer) {
            timer.end('encode');
            if (err) {
                return done(new Error('Plain renderer: ' + err.message));
            }

            return done(null, buffer, PLAIN_IMAGE_HEADERS, timer.getTimes());
        });
    } else {
        this.callbacks.push(callback);
    }
};

Renderer.prototype.getMetadata = function(callback) {
    return callback(null, {});
};
