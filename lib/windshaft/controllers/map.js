function MapController(app) {
    this._app = app;
}

module.exports = MapController;


MapController.prototype.register = function(app) {
    app.options(app.base_url_mapconfig, this.cors.bind(this));
    app.get(app.base_url_mapconfig + '/:token/:layer/attributes/:fid', this.attributes.bind(this));
};

// send CORS headers when client send options.
MapController.prototype.cors = function(req, res, next) {
    this._app.doCORS(res, "Content-Type");
    return next();
};

// Gets attributes for a given layer feature
MapController.prototype.attributes = function(req, res) {
    req.profiler.start('windshaft.maplayer_attribute');

    this._app.doCORS(res);

    this._app.getFeatureAttributes(req, res);
};
