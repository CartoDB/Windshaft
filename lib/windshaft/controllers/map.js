var step = require('step');


function MapController(app, mapBackend) {
    this._app = app;
    this._mapBackend = mapBackend;
}

module.exports = MapController;


MapController.prototype.register = function(app) {
    app.get(app.base_url_mapconfig + '/:token/:z/:x/:y@:scale_factor?x.:format', this.tile.bind(this));
    app.get(app.base_url_mapconfig + '/:token/:z/:x/:y.:format', this.tile.bind(this));
    app.get(app.base_url_mapconfig + '/:token/:layer/:z/:x/:y.(:format)', this.layer.bind(this));
    app.options(app.base_url_mapconfig, this.cors.bind(this));
    app.get(app.base_url_mapconfig, this.create.bind(this));
    app.post(app.base_url_mapconfig, this.createPost.bind(this));
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

    this._mapBackend.getFeatureAttributes(req, res);
};

MapController.prototype.create = function(req, res){
    var self = this;

    req.profiler.start('windshaft.createmap_get');

    this._app.doCORS(res);

    step(
        function setupParams(){
            self._app.req2params(req, this);
        },
        function initLayergroup(err/*, data*/){
            if (err) {
                throw err;
            }
            if ( ! req.params.config ) {
                throw new Error('layergroup GET needs a "config" parameter');
            }
            var cfg = JSON.parse(req.params.config);
            self._app.createLayergroup(cfg, req, this);
        },
        function finish(err, response){
            if (err){
                // TODO: change 'error' to a scalar ?
                response = { errors: [ err.message ] };
                var statusCode = self._app.findStatusCode(err);
                self._app.sendError(res, response, statusCode, 'GET LAYERGROUP', err);
            } else {
                self._app.sendResponse(res, [response, 200]);
            }
        }
    );
};

// TODO rewrite this so it is possible to share code with `MapController::create` method
MapController.prototype.createPost = function(req, res) {
    var self = this;

    req.profiler.start('windshaft.createmap_post');

    this._app.doCORS(res);

    step(
        function setupParams(){
            self._app.req2params(req, this);
        },
        function initLayergroup(err/*, data*/){
            req.profiler.done('req2params');
            if (err) {
                throw err;
            }
            if ( ! req.headers['content-type'] || req.headers['content-type'].split(';')[0] !== 'application/json' ) {
                throw new Error('layergroup POST data must be of type application/json');
            }
            var cfg = req.body;
            self._app.createLayergroup(cfg, req, this);
        },
        function finish(err, response){
            if (err){
                // TODO: change 'error' to a scalar ?
                response = { errors: [ err.message ] };
                var statusCode = self._app.findStatusCode(err);
                self._app.sendError(res, response, statusCode, 'POST LAYERGROUP', err);
            } else {
                self._app.sendResponse(res, [response, 200]);
            }
        }
    );
};

// Gets a tile for a given token and set of tile ZXY coords. (OSM style)
MapController.prototype.tile = function(req, res) {
    req.profiler.start('windshaft.map_tile');
    this.tileOrLayer(req, res);
};

// Gets a tile for a given token, layer set of tile ZXY coords. (OSM style)
MapController.prototype.layer = function(req, res, next) {
    if (req.params.token === 'static') {
        return next();
    }
    req.profiler.start('windshaft.maplayer_tile');
    this.tileOrLayer(req, res);
};

MapController.prototype.tileOrLayer = function (req, res) {
    var self = this;

    this._app.doCORS(res);
    step(
        function() {
            self._app.req2params(req, this);
        },
        function(err) {
            req.profiler.done('req2params');
            if ( err ) {
                throw err;
            }
            self._mapBackend.getTileOrGrid(req, res, this);
        },
        function finalize(err, req_ret, res_ret, tile, headers) {
            self.finalizeGetTileOrGrid(err, req, res, tile, headers);
            return null;
        },
        function finish(err) {
            if ( err ) {
                console.error("windshaft.tiles: " + err);
            }
        }
    );
};

// This function is meant for being called as the very last
// step by all endpoints serving tiles or grids
MapController.prototype.finalizeGetTileOrGrid = function(err, req, res, tile, headers) {
    var supportedFormats = {
        grid_json: true,
        json_torque: true,
        torque_json: true,
        png: true
    };

    var formatStat = 'invalid';
    if (req.params.format) {
        var format = req.params.format.replace('.', '_');
        if (supportedFormats[format]) {
            formatStat = format;
        }
    }

    if (err){
        // See https://github.com/Vizzuality/Windshaft-cartodb/issues/68
        var errMsg = err.message ? ( '' + err.message ) : ( '' + err );
        var statusCode = this._app.findStatusCode(err);

        // Rewrite mapnik parsing errors to start with layer number
        var matches = errMsg.match("(.*) in style 'layer([0-9]+)'");
        if (matches) {
            errMsg = 'style'+matches[2]+': ' + matches[1];
        }

        this._app.sendError(res, { errors: ['' + errMsg] }, statusCode, 'TILE RENDER', err);
        global.statsClient.increment('windshaft.tiles.error');
        global.statsClient.increment('windshaft.tiles.' + formatStat + '.error');
    } else {
        this._app.sendWithHeaders(res, tile, 200, headers);
        global.statsClient.increment('windshaft.tiles.success');
        global.statsClient.increment('windshaft.tiles.' + formatStat + '.success');
    }
};
