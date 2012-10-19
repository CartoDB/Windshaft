var   express     = require('express')
    , grainstore  = require('grainstore')
    , RenderCache = require('./render_cache')
    , _           = require('underscore')
    , mapnik      = require('mapnik')
    , Step        = require('step');

module.exports = function(opts){
    var opts = opts || {};

    // initialize core mml_store
    var mml_store  = new grainstore.MMLStore(opts.redis, opts.grainstore);

    // initialize render cache 60 seconds TTL
    var render_cache = new RenderCache(60000, mml_store);

    // optional log format
    var log_format = opts.hasOwnProperty('log_format') ? opts.log_format
      : '[:req[X-Real-IP] > :req[Host] @ :date] \033[90m:method\033[0m \033[36m:url\033[0m \033[90m:status :response-time ms -> :res[Content-Type]\033[0m';

    // initialize express server
    var app = express.createServer();
    app.enable('jsonp callback');
    app.use(express.bodyParser());
    if ( log_format ) {
      app.use(express.logger({
          // Allowing for unbuffered logging is mainly
          // used to avoid hanging during unit testing.
          // TODO: provide an explicit teardown function instead,
          //       releasing any event handler or timer set by
          //       this component.
          buffer: !opts.unbuffered_logging,
          format: log_format
      }));
    }

    //TODO: extract server config to a function
    // take in base url and base req2params from opts or throw exception
    if (!_.isString(opts.base_url) || !_.isFunction(opts.req2params)) throw new Error("Must initialise Windshaft with a base URL and req2params function");

    // Extend windshaft with all the elements of the options object
    _.extend(app, opts);

    // set default before/after filters if not set in opts object
    // filters can be used for custom authentication, caching, logging etc
    _.defaults(app, {
        // called pre tile render right at the start of the call
        beforeTileRender: function(req, res, callback) {
            callback(null);
        },
        // called immediately after the tile render. Called with tile output
        afterTileRender: function(req, res, tile, headers, callback) {
            callback(null, tile, headers);
        },
        // called before a map style is changed or deleted,
        //
        // @param callback function(err, req)
        //
        beforeStateChange: function(req, callback) {
            callback(null, req);
        },
        // called after a map style is changed or deleted
        afterStateChange: function(req, data, callback) {
            callback(null, data);
        },
        // called after a map style is changed 
        afterStyleChange: function(req, data, callback) {
            this.afterStateChange(req, data, callback);
        },
        // called after a map style is deleted
        afterStyleDelete: function(req, data, callback) {
            this.afterStateChange(req, data, callback);
        },
        // Set new map style
        // Requires a 'style' parameter containing carto (mapbox.com/carto)
        //
        // @param callback function(err, data) where data has currently NO meaning
        //
        setStyle: function(params, style, version, convert, callback) {
            var mml_builder = mml_store.mml_builder(params);
            mml_builder.setStyle(style, callback, version, convert);
        },
        // Delete a map style
        //
        // @param callback function(err, data) where data has currently NO meaning
        //
        delStyle: function(params, callback) {
            var mml_builder = mml_store.mml_builder(params);
            mml_builder.delStyle(callback);
        },
        // Enable CORS access by web browsers if set
        doCORS: function(res) {
          if(opts.enable_cors){
              res.header("Access-Control-Allow-Origin", "*");
              res.header("Access-Control-Allow-Headers", "X-Requested-With, X-Prototype-Version, X-CSRF-Token");
          }
        },
        getVersion: function() {
          var version = {};
          version.windshaft = require('../../package.json').version;
          version.grainstore = grainstore.version();
          version.node_mapnik = mapnik.version;
          version.mapnik = mapnik.versions.mapnik;
          return version;
        }
    });

    // Support both express-2.5 and express-3.0
    if ( express.version.split('.')[0] >= 3 ) {
        app.sendWithHeaders = function(res, what, status, headers) {
            res.set(headers);
            res.send(what, status);
        }
    } else {
        app.sendWithHeaders = function(res, what, status, headers) {
            res.send(what, headers, status);
        }
    }

    app.sendError = function(res, err, statusCode, label, tolog) {
      var olabel = '[';
      if ( label ) olabel += label + ' ';
      olabel += 'ERROR]';
      if ( ! tolog ) tolog = err;
      console.log(olabel + " -- " + statusCode + ": " + tolog);
      res.send(err, statusCode);
    }

    /*
    * Routing from here
    */

    // simple testable route
    app.get('/', function(req, res){
        res.send("JOHN RAMBO");
    });

    // version
    app.get('/version', function(req, res){
        var version = app.getVersion();
        res.send(version, 200);
    });

    // send CORS headers when client send options.
    // it should be like this if we want to allow cross origin posts
    // on development for example
    app.options(app.base_url + '/style', function(req, res, next){
        app.doCORS(res);
        return next();
    });

    // Retrieve the Carto style for a given map.
    // Returns styles stored in grainstore for a given params combination
    // Returns default if no style stored
    app.get(app.base_url + '/style', function(req, res){
        var mml_builder;

        app.doCORS(res);

        Step(
            function(){
                app.req2params(req, this);
            },
            function(err, data){
                if (err) throw err;

                mml_builder = mml_store.mml_builder(req.params);
                mml_builder.getStyle(this);
            },
            function(err, data){
                if (err){
                    var statusCode = 500;
                    //console.log("[GET STYLE ERROR] - status code: " + statusCode + "\n" + err);
                    //res.send({error: err.message}, statusCode);
                    app.sendError(res, {error: err.message}, statusCode, 'GET STYLE', err);
                } else {
                    res.send({style: data.style, style_version: data.version}, 200);
                }
            }
        );
    });

    // Set new map style
    // Requires a 'style' parameter containing carto (mapbox.com/carto)
    //
    // 1. If carto is invalid, respond with error messages + status
    // 2. If carto is valid, save it, reset the render pool and return 200
    //
    // Triggers state change filter
    app.post(app.base_url + '/style', function(req, res){
        var mml_builder;

        app.doCORS(res);

        Step(
            function(){
                app.req2params(req, this);
            },
            function(err, data){
                if (err) throw err;
                if (_.isUndefined(req.body) || _.isUndefined(req.body.style)) {
                    res.send({error: 'must send style information'}, 400);
                } else {
                    var that = this;
                    app.beforeStateChange(req, function(err, req) {
                        if ( err ) throw err;
                        app.setStyle(req.params,
                                     req.body.style,
                                     req.body.style_version,
                                     req.body.style_convert,
                                     that);
                    });
                }
            },
            function(err, data) {
                if (err) throw err;
                app.afterStyleChange(req, data, this);
            },
            function(err, data){
                if (err){
                    var statusCode = 500;
                    app.sendError(res, err.message.split('\n'), statusCode, 'POST STYLE', err);
                } else {
                    render_cache.reset(req);
                    res.send(200);
                }
            }
        );
    });


    // Delete Map Style
    // Triggers state change filter
    app.delete(app.base_url + '/style', function(req, res){
        var mml_builder;

        app.doCORS(res);

        Step(
            function(){
                app.req2params(req, this);
            },
            function(err, data){
                if (err) throw err;
                var that = this;
                app.beforeStateChange(req, function(err, req) {
                    if ( err ) throw err;
                    app.delStyle(req.params, that);
                });
            },
            function(err, data) {
                if (err) throw err;
                app.afterStyleDelete(req, data, this);
            },
            function(err, data){
                if (err){
                    var statusCode = 500;
                    app.sendError(res, err.message.split('\n'), statusCode, 'DELETE STYLE', err);
                } else {
                    render_cache.reset(req);
                    res.send(200);
                }
            }
        );
    });


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
    app.get(app.base_url + '/:z/:x/:y.*', function(req, res){

        app.doCORS(res);

        // strip format from end of url and attach to params
        req.params.format = req.params['0'];
        delete req.params['0'];

        // Wrap SQL requests in mapnik format if sent
        if(req.query.sql && req.query.sql !== '') {
            req.query.sql = "(" + req.query.sql + ") as cdbq";
        }

        var renderer;

        Step(
            function(){
                app.req2params(req, this);
            },
            function(err) {
                if (err) throw err;
                app.beforeTileRender(req, res, this);
            },
            function(err, data){
                if (err) throw err;
                render_cache.getRenderer(req, this);
            },
            function(err, r) {
                renderer = r;
                if (err) throw err;
                var my_func = (req.params.format === 'grid.json') ? 'getGrid' : 'getTile';
                renderer[my_func].call(renderer, req.params.z, req.params.x, req.params.y, this);
            },
            function(err, tile, headers) {
                if (err) throw err;
                app.afterTileRender(req, res, tile, headers, this);
            },
            function(err, tile, headers) {
                if ( renderer ) renderer.release();
                if (err){
                    var statusCode = 400;
                    // Find an appropriate statusCode
                    // TODO: turn into a function ?
                    if ( -1 != err.message.indexOf('permission denied') ) {
                      statusCode = 401;
                    }
                    else if ( -1 != err.message.indexOf('does not exist') ) {
                      statusCode = 404;
                    }
                    //console.log("[TILE RENDER ERROR] - status code: " + statusCode + "\n" + err);
                    app.sendError(res, {error: err.message}, statusCode, 'TILE RENDER', err);
                    //res.send({ error: err.message }, statusCode);
                } else {
                    app.sendWithHeaders(res, tile, 200, headers);
                }
            }
        );
    });


    return app;
};
