var fs = require('fs');
var request = require('request');

function Renderer(fallbackImage) {
    this.fallbackImage = fallbackImage;

    this.cachedTile = null;
    this.callbacks = null;
}

module.exports = Renderer;


Renderer.prototype.getTile = function(z, x, y, callback) {
    var self = this;

    if (!this.fallbackImage.type || !this.fallbackImage.src) {
        return callback(new Error('Image fallback not properly configured'));
    }

    if (this.cachedTile !== null) {
        return callback(null, this.cachedTile);
    }

    function done(err, buffer, headers) {
        self.cachedTile = buffer;
        self.callbacks.forEach(function(callback) {
            callback(err, buffer, headers);
        });
    }

    if (this.callbacks === null) {
        this.callbacks = [];
        this.callbacks.push(callback);

        switch (this.fallbackImage.type) {
            case 'fs':
                getFsTile(this.fallbackImage.src, done);
                break;
            case 'url':
                getUrlTile(this.fallbackImage.src, done);
                break;
            default:
                done(new Error('Invalid fallback image type: ' + this.fallbackImage.type));
                break;
        }
    } else {
        this.callbacks.push(callback);
    }
};

function getUrlTile(fallbackImageUrl, callback) {
    var requestOpts = {
        url: fallbackImageUrl,
        followRedirect: true,
        encoding: null
    };

    request(requestOpts, function(err, response, buffer) {
        if (err || response.statusCode !== 200) {
            var error = {
                error: 'Unable to fetch fallback tile',
                url: fallbackImageUrl
            };
            if (response && response.statusCode) {
                error.statusCode = response.statusCode;
            }
            return callback(error);
        }
        return callback(null, buffer, response.headers);
    });
}

function getFsTile(fallbackImagePath, callback) {
    fs.readFile(fallbackImagePath, { encoding: null }, function(err, buffer) {
        if (err) {
            return callback(err);
        }
        return callback(null, buffer);
    });
}
