'use strict';

const Timer = require('../stats/timer');

module.exports = class TileBackend {
    constructor (rendererCache) {
        this._rendererCache = rendererCache;
    }

    // Gets a tile for a given set of tile ZXY coords. (OSM style)
    // Call with .png for images, or .grid.json for UTFGrid tiles
    //
    // query string arguments:
    //
    // * sql - use SQL to filter displayed results or perform operations pre-render
    // * style - assign a per tile style using carto
    // * interactivity - specify which columns to represent in the UTFGrid
    // * cache_buster - specify to ensure a new renderer is used
    // * geom_type - specify default style to use if no style present
    getTile (mapConfigProvider, params, callback) {
        const { format, interactivity, token, z, x, y } = params;

        // TODO: review if needed see cartonik's validations
        if (format === 'grid.json' && !interactivity) {
            if (!token) { // token embeds interactivity
                return callback(new Error('Missing interactivity parameter'));
            }
        }

        const timer = new Timer();
        const extraHeaders = {};
        timer.start('getTileOrGrid');
        timer.start('getRenderer');
        this._rendererCache.getRenderer(mapConfigProvider, (err, renderer, isCached) => {
            timer.end('getRenderer');
            if (err) {
                if (renderer) {
                    renderer.release();
                }

                return callback(err);
            }

            if (isCached) {
                extraHeaders['X-Windshaft-Cache'] = Date.now() - renderer.ctime;
            }

            timer.start('render-' + format.replace('.', '-'));
            renderer.getTile(format, +z, +x, +y)
                .then(({ buffer, headers, stats }) => {
                    timer.end('render-' + format.replace('.', '-'));
                    timer.end('getTileOrGrid');

                    return callback(null, buffer, Object.assign(extraHeaders, headers), Object.assign(timer.getTimes(), stats));
                })
                .catch((err) => callback(err))
                .finally(() => {
                    if (renderer) {
                        renderer.release();
                    }
                });
        });
    }
};
