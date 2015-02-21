var getTilerOrGrid = require('./map').getTileOrGrid;


function TilesController(app, mapBackend) {
    this._app = app;
    this._mapBackend = mapBackend;
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

    req.profiler.start('windshaft.tiles');

    // strip format from end of url and attach to params
    req.params.format = req.params.splice(0,1)[0];

    // Wrap SQL requests in mapnik format if sent
    if(req.query.sql && req.query.sql !== '') {
        req.query.sql = "(" + req.query.sql.replace(/;\s*$/, '') + ") as cdbq";
    }

    return getTilerOrGrid(this._app, this._mapBackend, req, res);
};
