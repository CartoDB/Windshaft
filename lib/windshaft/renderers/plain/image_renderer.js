var assert = require('assert');
var mapnik = require('mapnik');
var blend = mapnik.blend;
var step = require('step');
var Timer = require('../../stats/timer');

function ImageRenderer(imageBuffer, options) {
    this.imageBuffer = imageBuffer;

    this.options = options || {};
    this.options.tileSize = this.options.tileSize || 256;
    this.options.format = this.options.format || 'png8:m=h';
}

module.exports = ImageRenderer;

var PLAIN_IMAGE_HEADERS = { 'Content-Type': 'image/png' };


ImageRenderer.prototype.getTile = function(z, x, y, callback) {
    var self = this;
    var timer = new Timer();
    timer.start('render');
    timer.end('render');

    var TILE_SIZE = this.options.tileSize;

    step(
        function ImageRenderer$MapnikImage() {
            mapnik.Image.fromBytes(self.imageBuffer, this);
        },
        function ImageRenderer$PrepareTiles(err, image) {
            assert.ifError(err);

            var tiles = [];
            var imageWidth = image.width();
            var imageHeight = image.height();

            var coveredHeight = 0;

            var tY = 0;
            while(coveredHeight < TILE_SIZE) {
                var tX = 0;
                var yPos = tY * imageHeight - (y * TILE_SIZE % imageHeight);

                var coveredWidth = 0;

                while (coveredWidth < TILE_SIZE) {
                    var xPos = tX * imageWidth - (x * TILE_SIZE % imageWidth);
                    tiles.push({
                        buffer: self.imageBuffer,
                        headers: {},
                        stats: {},
                        x: xPos,
                        y: yPos,
                        reencode: true
                    });

                    coveredWidth += (xPos < 0) ? (imageWidth + xPos) : imageWidth;
                    tX++;
                }

                coveredHeight += (yPos < 0) ? (imageHeight + yPos) : imageHeight;
                tY++;
            }

            return tiles;
        },
        function ImageRenderer$BlendTiles(err, tiles) {
            assert.ifError(err);

            blend(tiles, {
                format: 'png',
                width: TILE_SIZE,
                height: TILE_SIZE,
                reencode: true
            }, this);
        },
        function ImageRenderer$Finish(err, buffer) {
            if (err) {
                return callback(err);
            }
            return callback(null, buffer, PLAIN_IMAGE_HEADERS, {});
        }
    );
};

ImageRenderer.prototype.getMetadata = function(callback) {
    return callback(null, {});
};

ImageRenderer.prototype.close = function() {
    this.cachedTile = null;
};
