var mapnik = require('mapnik');
var Timer = require('../../stats/timer');

function ColorRenderer(mapnikColor, options) {
    this.mapnikColor = mapnikColor || '#ffffff';

    this.options = options || {};
    this.options.tileSize = this.options.tileSize || 256;
    this.options.format = this.options.format || 'png8:m=h';

    this.cachedTile = null;
    this.callbacks = null;
}

module.exports = ColorRenderer;

var PLAIN_IMAGE_HEADERS = { 'Content-Type': 'image/png' };


ColorRenderer.prototype.getTile = function(z, x, y, options, callback) {
    var self = this;

    if (this.cachedTile !== null) {
        return callback(null, this.cachedTile, PLAIN_IMAGE_HEADERS, {});
    }


    function done(err, buffer, headers, stats) {
        self.cachedTile = buffer || null;
        self.callbacks.forEach(function(callback) {
            callback(err, buffer, headers, stats, options.requestId);
        });
    }

    if (this.callbacks === null) {
        this.callbacks = [];
        this.callbacks.push(callback);

        var timer = new Timer();

        timer.start('render');
        var image = new mapnik.Image(this.options.tileSize, this.options.tileSize);
        image.background = this.mapnikColor;

        timer.start('fill');
        image.fill(this.mapnikColor, function  (err, im_res) {
            timer.end('fill');
            if (err) {
                return done(new Error('Plain renderer: ' + err.message));
            }
            timer.start('encode');
            im_res.encode(self.options.format, function(err, buffer) {
                timer.end('encode');
                timer.end('render');

                if (err) {
                    return done(new Error('Plain renderer: ' + err.message));
                }

                return done(null, buffer, PLAIN_IMAGE_HEADERS, timer.getTimes());
            });
        });
    } else {
        this.callbacks.push(callback);
    }
};

ColorRenderer.prototype.getMetadata = function(callback) {
    return callback(null, {});
};

ColorRenderer.prototype.close = function() {
    this.cachedTile = null;
};
