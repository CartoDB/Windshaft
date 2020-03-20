'use strict';

function wrap (x, z) {
    var limit = (1 << z);
    return ((x % limit) + limit) % limit;
}

module.exports = class BaseAdaptor {
    constructor (renderer, format, onTileErrorStrategy) {
        this.renderer = renderer;
        if (onTileErrorStrategy) {
            this.onTileErrorStrategy = function (err, tile, headers, stats, format) {
                return new Promise((resolve, reject) => {
                    onTileErrorStrategy(err, tile, headers, stats, format, (err, buffer, headers, stats) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve({ buffer, headers, stats });
                    });
                });
            };
        }
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
                const [buffer, headers, stats] = [null, {}, {}];
                return this.onTileErrorStrategy(err, buffer, headers, stats, format);
            }
            throw err;
        }
    }

    async close () {
        await this.renderer.close();
    }

    async getMetadata () {
        return this.renderer.getMetadata();
    }

    getStats () {
        return this.renderer.getStats();
    }
};
