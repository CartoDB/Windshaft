var Step = require('step');


function MapBackend(app, renderCache) {
    this._app = app;
    this._renderCache = renderCache;
}

module.exports = MapBackend;


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
//
// Triggers beforeTileRender and afterTileRender render filters
//
MapBackend.prototype.getTileOrGrid = function(req, res, callback){

    var self = this;

    req.profiler.start('getTileOrGrid');

    var renderer;

    Step(
        function() {
            self._app.beforeTileRender(req, res, this);
        },
        function(err){
            req.profiler.done('beforeTileRender');
            if (err) throw err;
            if (req.params.format === 'grid.json' && !req.params.interactivity) {
                if ( ! req.params.token ) { // token embeds interactivity
                    throw new Error("Missing interactivity parameter");
                }
            }
            self._renderCache.getRenderer(req, this);

        },
        function(err, r, is_cached) {
            req.profiler.done('getRenderer');
            renderer = r;
            if ( is_cached ) {
                res.header('X-Windshaft-Cache', Date.now() - renderer.ctime);
            }
            if (err) throw err;
            renderer.getTile(+req.params.z, +req.params.x, +req.params.y, this);
        },
        function(err, tile, headers) {
            req.profiler.done('render-'+req.params.format.replace('.','-'));
            if (err) throw err;
            self._app.afterTileRender(req, res, tile, headers || {}, this);
        },
        function(err, tile, headers) {
            req.profiler.done('afterTileRender');
            if ( renderer ) {
                renderer.release();
                req.profiler.done('renderer_release');
            }
            // this should end getTileOrGrid profile task
            req.profiler.end();
            callback(err, req, res, tile, headers);
        }
    );
};
