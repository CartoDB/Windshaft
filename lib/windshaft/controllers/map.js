var Step = require('step');


function MapController(app) {
    this._app = app;
}

module.exports = MapController;


MapController.prototype.register = function(app) {
    app.options(app.base_url_mapconfig, this.cors.bind(this));
    app.get(app.base_url_mapconfig + '/:token/:layer/attributes/:fid', this.attributes.bind(this));
    app.get(app.base_url_mapconfig, this.create.bind(this));
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

MapController.prototype.create = function(req, res){
    var self = this;

    req.profiler.start('windshaft.createmap_get');

    this._app.doCORS(res);

    Step(
        function setupParams(){
            self._app.req2params(req, this);
        },
        function initLayergroup(err, data){
            if (err) throw err;
            if ( ! req.params.config )
                throw new Error('layergroup GET needs a "config" parameter');
            var cfg = JSON.parse(req.params.config);
            self._app.createLayergroup(cfg, req, this);
        },
        function finish(err, response){
            var statusCode = 200;
            if (err){
                // TODO: change 'error' to a scalar ?
                response = { errors: [ err.message ] };
                statusCode = self._app.findStatusCode(err);
            }
            self._app.sendResponse(res, [response, statusCode]);
        }
    );
};
