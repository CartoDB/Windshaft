'use strict';

function wrap (x, z) {
    var limit = (1 << z);
    return ((x % limit) + limit) % limit;
}

module.exports = class BaseAdaptor {
    constructor (renderer, onTileErrorStrategy) {
        this.renderer = renderer;
        if (onTileErrorStrategy) {
            // TODO: (Breaking Change) Drepecate old onTileErrorStrategy's signature;
            // the new signature function onTileErrorStrategy (err, format)
            // consider `async function onTileErrorStrategy ({ err, format, ...})`
            const [buffer, headers, stats] = [null, {}, {}];

            this.onTileErrorStrategy = function (err, format) {
                return new Promise((resolve, reject) => {
                    onTileErrorStrategy(err, buffer, headers, stats, format, (err, buffer, headers, stats) => {
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
                return this.onTileErrorStrategy(err, format);
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
