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

    // waiting for async/await to refactor
    try {
        mapnik.Image.fromBytes(this.imageBuffer, (err, image) => {
            if (err) {
                return callback(err);
            }

            const tiles = getTilesFromImage(image, x, y, this.imageBuffer, this.options.tileSize);

            const blendOptions = {
                format: 'png',
                width: this.options.tileSize,
                height: this.options.tileSize,
                reencode: true
            };

            blend(tiles, blendOptions, function (err, buffer) {
                if (err) {
                    return callback(err);
                }

                return callback(null, buffer, PLAIN_IMAGE_HEADERS, {});
            });
        });
    } catch (error) {
        return callback(error);
    }
};

ImageRenderer.prototype.getMetadata = function(callback) {
    return callback(null, {});
};

ImageRenderer.prototype.close = function() {
    this.cachedTile = null;
};

function getTilesFromImage(image, x, y, imageBuffer, tileSize) {
    let tiles = [];
    const imageWidth = image.width();
    const imageHeight = image.height();

    let coveredHeight = 0;

    let tY = 0;
    while(coveredHeight < tileSize) {
        let tX = 0;
        const yPos = tY * imageHeight - (y * tileSize % imageHeight);

        let coveredWidth = 0;

        while (coveredWidth < tileSize) {
            const xPos = tX * imageWidth - (x * tileSize % imageWidth);
            tiles.push({
                buffer: imageBuffer,
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
}
