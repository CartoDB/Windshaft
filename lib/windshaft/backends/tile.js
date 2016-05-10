var assert = require('assert');

var _ = require('underscore');
var step = require('step');

var Timer = require('../stats/timer');

function TileBackend(rendererCache) {
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
TileBackend.prototype.getTile = function(mapConfigProvider, params, callback) {

    var self = this;

    var timer = new Timer();

    var renderer;

    timer.start('getTileOrGrid');
    var extraHeaders = {};
    step(
        function() {
            if (params.format === 'grid.json' && !params.interactivity) {
                if ( ! params.token ) { // token embeds interactivity
                    throw new Error("Missing interactivity parameter");
                }
            }
            timer.start('getRenderer');
            self._rendererCache.getRenderer(mapConfigProvider, params.z, this);
        },
        function(err, r, is_cached) {
            timer.end('getRenderer');
            renderer = r;
            if ( is_cached ) {
                extraHeaders['X-Windshaft-Cache'] = Date.now() - renderer.ctime;
            }
            assert.ifError(err);
            timer.start('render-' + params.format.replace('.','-'));
            renderer.getTile(+params.z, +params.x, +params.y, this);
        },
        function(err, tile, headers, stats) {
            timer.end('render-' + params.format.replace('.','-'));

            if ( renderer ) {
                renderer.release();
            }
            timer.end('getTileOrGrid');
            callback(err, tile, _.extend(extraHeaders, headers), _.extend(timer.getTimes(), stats));
        }
    );
};
