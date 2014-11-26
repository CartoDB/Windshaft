function MapController(app) {
    this._app = app;
}

module.exports = MapController;


MapController.prototype.register = function(app) {
    app.options(app.base_url_mapconfig, this.cors.bind(this));
};

// send CORS headers when client send options.
MapController.prototype.cors = function(req, res, next) {
    this._app.doCORS(res, "Content-Type");
    return next();
};
