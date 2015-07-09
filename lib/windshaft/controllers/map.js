var assert = require('assert');
var step = require('step');

var MapStoreMapConfigProvider = require('../models/mapstore_mapconfig_provider');

/**
 * @param app
 * @param {MapStore} mapStore
 * @param {MapBackend} mapBackend
 * @param {TileBackend} tileBackend
 * @param {AttributesBackend} attributesBackend
 * @constructor
 */
function MapController(app, mapStore, mapBackend, tileBackend, attributesBackend) {
    this._app = app;
    this.mapStore = mapStore;
    this.mapBackend = mapBackend;
    this.tileBackend = tileBackend;
    this.attributesBackend = attributesBackend;
}

module.exports = MapController;


MapController.prototype.register = function(app) {
    app.get(app.base_url_mapconfig + '/:token/:z/:x/:y@:scale_factor?x.:format', this.tile.bind(this));
    app.get(app.base_url_mapconfig + '/:token/:z/:x/:y.:format', this.tile.bind(this));
    app.get(app.base_url_mapconfig + '/:token/:layer/:z/:x/:y.(:format)', this.layer.bind(this));
    app.options(app.base_url_mapconfig, this.cors.bind(this));
    app.get(app.base_url_mapconfig, this.createGet.bind(this));
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
    var self = this;

    req.profiler.start('windshaft.maplayer_attribute');

    this._app.doCORS(res);

    step(
        function setupParams() {
            self._app.req2params(req, this);
        },
        function retrieveFeatureAttributes(err) {
            req.profiler.done('req2params');

            assert.ifError(err);

            self.attributesBackend.getFeatureAttributes(req.params, false, this);
        },
        function finish(err, tile, stats) {
            req.profiler.add(stats || {});

            if (err) {
                // See https://github.com/Vizzuality/Windshaft-cartodb/issues/68
                var errMsg = err.message ? ( '' + err.message ) : ( '' + err );
                var statusCode = self._app.findStatusCode(err);
                self._app.sendError(res, { errors: [errMsg] }, statusCode, 'GET ATTRIBUTES', err);
            } else {
                self._app.sendResponse(res, [tile, 200]);
            }
        }
    );

};

MapController.prototype.create = function(req, res, prepareConfigFn) {
    var self = this;

    this._app.doCORS(res);

    step(
        function setupParams(){
            self._app.req2params(req, this);
        },
        prepareConfigFn,
        function initLayergroup(err, requestMapConfig) {
            assert.ifError(err);
            self.mapBackend.createLayergroup(requestMapConfig, req.params, this);
        },
        function finish(err, response){
            if (err) {
                response = { errors: [ err.message ] };
                var statusCode = self._app.findStatusCode(err);
                self._app.sendError(res, response, statusCode, 'GET LAYERGROUP', err);
            } else {
                self._app.sendResponse(res, [response, 200]);
            }
        }
    );
};

MapController.prototype.createGet = function(req, res){
    req.profiler.start('windshaft.createmap_get');

    this.create(req, res, function createGet$prepareConfig(err, req) {
        assert.ifError(err);
        if ( ! req.params.config ) {
            throw new Error('layergroup GET needs a "config" parameter');
        }
        return JSON.parse(req.params.config);
    });
};

// TODO rewrite this so it is possible to share code with `MapController::create` method
MapController.prototype.createPost = function(req, res) {
    req.profiler.start('windshaft.createmap_post');

    this.create(req, res, function createPost$prepareConfig(err, req) {
        assert.ifError(err);
        if ( ! req.headers['content-type'] || req.headers['content-type'].split(';')[0] !== 'application/json' ) {
            throw new Error('layergroup POST data must be of type application/json');
        }
        return req.body;
    });
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
        function mapController$prepareParams() {
            self._app.req2params(req, this);
        },
        function mapController$getTile(err) {
            req.profiler.done('req2params');
            if ( err ) {
                throw err;
            }
            self.tileBackend.getTile(new MapStoreMapConfigProvider(self.mapStore, req.params), req.params, this);
        },
        function mapController$finalize(err, tile, headers, stats) {
            req.profiler.add(stats);
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
