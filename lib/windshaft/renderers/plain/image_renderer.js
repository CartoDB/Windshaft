var mapnik = require('@carto/mapnik');
var blend = mapnik.blend;
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
    var timer = new Timer();
    timer.start('render');
    timer.end('render');

    var TILE_SIZE = this.options.tileSize;

    mapnik.Image.fromBytes(this.imageBuffer, (err, image) => {
        if (err) {
            return callback(err);
        }

        let tiles = [];
        const imageWidth = image.width();
        const imageHeight = image.height();

        let coveredHeight = 0;

        let tY = 0;
        while(coveredHeight < TILE_SIZE) {
            let tX = 0;
            const yPos = tY * imageHeight - (y * TILE_SIZE % imageHeight);

            let coveredWidth = 0;

            while (coveredWidth < TILE_SIZE) {
                const xPos = tX * imageWidth - (x * TILE_SIZE % imageWidth);
                tiles.push({
                    buffer: this.imageBuffer,
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

        const blendOptions = {
            format: 'png',
            width: TILE_SIZE,
            height: TILE_SIZE,
            reencode: true
        };

        blend(tiles, blendOptions, function (err, buffer) {
            if (err) {
                return callback(err);
            }

            return callback(null, buffer, PLAIN_IMAGE_HEADERS, {});
        });
    });
};

ImageRenderer.prototype.getMetadata = function(callback) {
    return callback(null, {});
};

ImageRenderer.prototype.close = function() {
    this.cachedTile = null;
};
