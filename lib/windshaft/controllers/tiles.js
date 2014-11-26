var Step = require('step');


function TilesController(app) {
    this._app = app;
}

module.exports = TilesController;


TilesController.prototype.register = function(app) {
    app.options(app.base_url + '/:z/:x/:y.*', this.cors.bind(this));
    app.get(app.base_url + '/:z/:x/:y.*', this.retrieve.bind(this));
};

// send CORS headers when client send options.
TilesController.prototype.cors = function(req, res, next) {
    this._app.doCORS(res);
    return next();
};

TilesController.prototype.retrieve = function(req, res) {
    this._app.doCORS(res);

    var self = this;

    req.profiler.start('windshaft.tiles');

    // strip format from end of url and attach to params
    req.params.format = req.params.splice(0,1)[0];

    // Wrap SQL requests in mapnik format if sent
    if(req.query.sql && req.query.sql !== '') {
        req.query.sql = "(" + req.query.sql.replace(/;\s*$/, '') + ") as cdbq";
    }

    Step(
        function() {
            self._app.req2params(req, this);
        },
        function(err) {
            req.profiler.done('req2params');
            if ( err ) throw err;
            self._app.getTileOrGrid(req, res, this); // legacy get map tile endpoint
        },
        function finalize(err, req_ret, res_ret, tile, headers) {
            self._app.finalizeGetTileOrGrid(err, req, res, tile, headers);
            return null;
        },
        function finish(err) {
            if ( err ) console.error("windshaft.tiles: " + err);
        }
    );
};
