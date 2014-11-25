var Step        = require('step'),
    _           = require('underscore');


function TilesStyleController(app, renderCache, mmlStore) {
    this._app = app;
    this._renderCache = renderCache;
    this._mmlStore = mmlStore;
}

module.exports = TilesStyleController;


TilesStyleController.prototype.register = function(app) {
    app.options(app.base_url + '/style', this.cors.bind(this));
    app.get(app.base_url + '/style', this.retrieve.bind(this));
    app.post(app.base_url + '/style', this.create.bind(this));
    app.del(app.base_url + '/style', this.destroy.bind(this));
};

// send CORS headers when client send options.
// it should be like this if we want to allow cross origin posts on development for example
TilesStyleController.prototype.cors = function(req, res, next) {
    this._app.doCORS(res);
    return next();
};

// Retrieve the Carto style for a given map.
// Returns styles stored in grainstore for a given params combination
// Returns default if no style stored
TilesStyleController.prototype.retrieve = function(req, res) {
    var self = this;

    req.profiler.start('windshaft.get_style');

    var mml_builder;

    self._app.doCORS(res);

    Step(
        function(){
            self._app.req2params(req, this);
        },
        function(err, data){
            if (err) throw err;
            var next = this;
            mml_builder = self._mmlStore.mml_builder(req.params, function(err) {
                if (err) { next(err); return; }
                var convert = req.query.style_convert || req.body.style_convert;
                mml_builder.getStyle(next, convert);
            });
        },
        function(err, data){
            if (err){
                var statusCode = self._app.findStatusCode(err);
                //console.log("[GET STYLE ERROR] - status code: " + statusCode + "\n" + err);
                //app.sendResponse(res, [{error: err.message}, statusCode]);
                self._app.sendError(res, {error: err.message}, statusCode, 'GET STYLE', err);
            } else {
                self._app.sendResponse(res, [{style: data.style, style_version: data.version}, 200]);
            }
        }
    );
};

// Set new map style
// Requires a 'style' parameter containing carto (mapbox.com/carto)
//
// 1. If carto is invalid, respond with error messages + status
// 2. If carto is valid, save it, reset the render pool and return 200
//
// Triggers state change filter
TilesStyleController.prototype.create = function(req, res){
    var self = this;

    req.profiler.start('windshaft.post_style');

    self._app.doCORS(res);

    Step(
        function(){
            self._app.req2params(req, this);
        },
        function(err, data){
            req.profiler.done('req2params');
            if (err) throw err;
            if (_.isUndefined(req.body) || _.isUndefined(req.body.style)) {
                var err = 'must send style information';
                self._app.sendError(res, {error: err}, 400, 'POST STYLE', err);
            } else {
                var that = this;
                self._app.beforeStateChange(req, function(err, req) {
                    req.profiler.done('beforeStateChange');
                    if ( err ) throw err;
                    self._app.setStyle(req.params,
                        req.body.style,
                        req.body.style_version,
                        req.body.style_convert,
                        that);
                });
            }
        },
        function(err, data) {
            req.profiler.done('setStyle');
            if (err) throw err;
            self._app.afterStyleChange(req, data, this);
        },
        function(err, data){
            req.profiler.done('afterStyleChange');
            if (err){
                var statusCode = self._app.findStatusCode(err);
                // See https://github.com/Vizzuality/Windshaft-cartodb/issues/68
                var errMsg = err.message ? ( '' + err.message ) : ( '' + err );
                self._app.sendError(res, errMsg.split('\n'), statusCode, 'POST STYLE', err);
            } else {
                self._renderCache.reset(req);
                self._app.sendResponse(res, [200]);
            }
        }
    );
};

// Delete Map Style
// Triggers state change filter
TilesStyleController.prototype.destroy = function(req, res){
    var self = this;

    req.profiler.start('windshaft.del_style');

    self._app.doCORS(res);

    Step(
        function(){
            self._app.req2params(req, this);
        },
        function(err, data){
            if (err) throw err;
            var that = this;
            self._app.beforeStateChange(req, function(err, req) {
                if ( err ) throw err;
                self._app.delStyle(req.params, that);
            });
        },
        function(err, data) {
            if (err) throw err;
            self._app.afterStyleDelete(req, data, this);
        },
        function(err, data){
            if (err){
                var statusCode = self._app.findStatusCode(err);
                // See https://github.com/Vizzuality/Windshaft-cartodb/issues/68
                var errMsg = err.message ? ( '' + err.message ) : ( '' + err );
                self._app.sendError(res, errMsg.split('\n'), statusCode, 'DELETE STYLE', err);
            } else {
                self._renderCache.reset(req);
                self._app.sendResponse(res, [200]);
            }
        }
    );
};
