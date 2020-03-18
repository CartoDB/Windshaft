'use strict';

const { promisify } = require('util');
const fs = require('fs');
const readFile = promisify(fs.readFile);
const fetchImage = require('./fetch-image');

module.exports = class HttpFallbackRenderer {
    constructor (fallbackImage) {
        this.fallbackImage = fallbackImage;
        this.cachedTile = null;
    }

    async getTile (format, z, x, y) {
        if (!this.fallbackImage.type || !this.fallbackImage.src) {
            throw new Error('Image fallback not properly configured');
        }

        if (this.cachedTile !== null) {
            return this.cachedTile;
        }

        const { buffer, headers, stats } = await getTileStrategy(this.fallbackImage);
        this.cachedTile = { buffer, headers, stats };

        return { buffer, headers, stats };
    }

    async getMetadata () {
        return {};
    }

    async close () {
        this.cachedTile = null;
    }

    getStats () {
        return {
            pool: {
                count: 0,
                unused: 0,
                waiting: 0
            },
            cache: {
                png: 0,
                grid: 0
            }
        };
    }
};

async function getTileStrategy (fallbackImage) {
    switch (fallbackImage.type) {
    case 'fs':
        return getFsTile(fallbackImage.src);
    case 'url':
        return getUrlTile(fallbackImage.src);
    default:
        throw new Error(`Invalid fallback image type: ${fallbackImage.type}`);
    }
}

async function getUrlTile (fallbackImageUrl) {
    const requestOpts = {
        url: fallbackImageUrl,
        followRedirect: true,
        encoding: null
    };

    return fetchImage(requestOpts);
}

async function getFsTile (fallbackImagePath, callback) {
    return {
        buffer: await readFile(fallbackImagePath, { encoding: null }),
        headers: {},
        stats: {}
    };
}
