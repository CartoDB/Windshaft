'use strict';

const { promisify } = require('util');
const mapnik = require('@carto/mapnik');
const blend = promisify(mapnik.blend);
const imageFromBytes = promisify(mapnik.Image.fromBytes);
const Timer = require('../../stats/timer');
const PLAIN_IMAGE_HEADERS = { 'Content-Type': 'image/png' };

module.exports = class PlainImageRenderer {
    constructor (imageBuffer, options) {
        this.imageBuffer = imageBuffer;

        this.options = options || {};
        this.options.tileSize = this.options.tileSize || 256;
        this.options.format = this.options.format || 'png8:m=h';
    }

    async getTile (format, z, x, y) {
        const timer = new Timer();
        timer.start('render');

        const image = await imageFromBytes(this.imageBuffer);
        const tiles = getTilesFromImage(image, x, y, this.imageBuffer, this.options.tileSize);

        const blendOptions = {
            format: 'png',
            width: this.options.tileSize,
            height: this.options.tileSize,
            reencode: true
        };

        const buffer = await blend(tiles, blendOptions);

        timer.end('render');

        return { buffer, headers: PLAIN_IMAGE_HEADERS, stats: timer.getTimes() };
    }

    async close () {
        this.cachedTile = null;
    }
};

function getTilesFromImage (image, x, y, imageBuffer, tileSize) {
    const tiles = [];
    const imageWidth = image.width();
    const imageHeight = image.height();

    let coveredHeight = 0;

    let tY = 0;
    while (coveredHeight < tileSize) {
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
