var mapnik = require('mapnik');

function Renderer(color, options) {
    this.color = color || '#ffffff';

    this.options = options || {};
    this.options.tileSize = this.options.tileSize || 256;
    this.options.format = this.options.format || 'png8:m=h';

    this.cachedTile = null;
    this.callbacks = null;
}

module.exports = Renderer;


Renderer.prototype.getTile = function(z, x, y, callback) {
    var self = this;

    if (this.cachedTile !== null) {
        return callback(null, this.cachedTile);
    }

    function done(err, buffer) {
        self.cachedTile = buffer || null;
        self.callbacks.forEach(function(callback) {
            callback(err, buffer);
        });
    }

    if (this.callbacks === null) {
        this.callbacks = [];
        this.callbacks.push(callback);

        var image = new mapnik.Image(this.options.tileSize, this.options.tileSize);
        try {
            image.background = new mapnik.Color(this.color);
        } catch (e) {
            return done(new Error('Plain renderer: ' + e.message));
        }

        image.encode(this.options.format, function(err, buffer) {
            if (err) {
                return done(new Error('Plain renderer: ' + e.message));
            }

            return done(null, buffer);
        });
    } else {
        this.callbacks.push(callback);
    }
};
