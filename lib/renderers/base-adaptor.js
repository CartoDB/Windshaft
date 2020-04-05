'use strict';

function wrap (x, z) {
    var limit = (1 << z);
    return ((x % limit) + limit) % limit;
}

module.exports = class BaseAdaptor {
    constructor (renderer, onTileErrorStrategy) {
        this.renderer = renderer;
        this.onTileErrorStrategy = onTileErrorStrategy;
    }

    get () {
        return this.renderer;
    }

    async getTile (format, z, x, y) {
        try {
            const { buffer, headers, stats } = await this.renderer.getTile(format, z, wrap(x, z), y);
            return { buffer, headers, stats };
        } catch (err) {
            if (this.onTileErrorStrategy) {
                return this.onTileErrorStrategy(err, format);
            }
            throw err;
        }
    }

    async close () {
        if (typeof this.renderer.close === 'function') {
            await this.renderer.close();
        }
    }

    async getMetadata () {
        if (typeof this.renderer.getMetadata === 'function') {
            return this.renderer.getMetadata();
        }
    }

    getStats () {
        if (typeof this.renderer.getStats === 'function') {
            return this.renderer.getStats();
        }
    }
};
