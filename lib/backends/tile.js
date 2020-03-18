'use strict';

const Timer = require('../stats/timer');

function TileBackend (rendererCache) {
    this._rendererCache = rendererCache;
}

module.exports = TileBackend;

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
TileBackend.prototype.getTile = function (mapConfigProvider, params, callback) {
    if (params.format === 'grid.json' && !params.interactivity) {
        if (!params.token) { // token embeds interactivity
            return callback(new Error('Missing interactivity parameter'));
        }
    }

    const timer = new Timer();
    const extraHeaders = {};
    timer.start('getTileOrGrid');
    timer.start('getRenderer');
    this._rendererCache.getRenderer(mapConfigProvider, function (err, renderer, isCached) {
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

        timer.start('render-' + params.format.replace('.', '-'));
        renderer.getTile(params.format, +params.z, +params.x, +params.y)
            .then(({ buffer, headers, stats }) => {
                timer.end('render-' + params.format.replace('.', '-'));
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
};
