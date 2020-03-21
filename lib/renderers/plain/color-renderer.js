'use strict';

const mapnik = require('@carto/mapnik');
const Timer = require('../../stats/timer');
const { promisify } = require('util');
const PLAIN_IMAGE_HEADERS = { 'Content-Type': 'image/png' };

module.exports = class PlainColorRenderer {
    constructor (mapnikColor, options) {
        this.mapnikColor = mapnikColor || new mapnik.Color('white');

        this.options = options || {};
        this.options.tileSize = this.options.tileSize || 256;
        this.options.format = this.options.format || 'png8:m=h';

        this.cachedTile = null;
    }

    async getTile (format, z, x, y) {
        const timer = new Timer();
        timer.start('render');

        if (this.cachedTile !== null) {
            timer.end('render');
            return { buffer: this.cachedTile, headers: PLAIN_IMAGE_HEADERS, stats: timer.getTimes() };
        }

        try {
            const image = new mapnik.Image(this.options.tileSize, this.options.tileSize);
            const fill = promisify(image.fill.bind(image));
            const imageFilled = await fill(this.mapnikColor);
            timer.start('encode');
            const encode = promisify(imageFilled.encode.bind(imageFilled));
            const buffer = await encode(this.options.format);
            timer.end('encode');
            timer.end('render');

            return { buffer, headers: PLAIN_IMAGE_HEADERS, stats: timer.getTimes() };
        } catch (err) {
            throw new Error(`Plain renderer: ${err.message}`);
        }
    }

    async close () {
        this.cachedTile = null;
    };
};
