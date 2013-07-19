var   express     = require('express')
    , grainstore  = require('grainstore')
    , RenderCache = require('./render_cache')
    , _           = require('underscore')
    , mapnik      = require('mapnik')
    , Step        = require('step')
    , semver      = require('semver')
    , LRU         = require('lru-cache')
    , Profiler    = require('./profiler')
;

//
// @param opts server options object. Example value:
//     {
//        base_url: '/database/:dbname/table/:table',
//        base_url_notable: '/database/:dbname',
//        req2params: function(req, callback){
//          callback(null,req)
//        },
//        grainstore: {
//          datasource: {
//            user:'postgres', host: '127.0.0.1',
//        		port: 5432
//          }
//        }, //see grainstore npm for other options
//        mapnik: {
//          metatile: 4,
//          bufferSize:64
//        },
//        renderCache: {
//          ttl: 60000, // seconds
//        },
//        redis: {host: '127.0.0.1', port: 6379},
//        // this two filters are optional
//        beforeTileRender: function(req, res, callback) {
//            callback(null);
//        },
//        afterTileRender: function(req, res, tile, headers, callback) {
//            callback(null, tile, headers);
//        },
//        useProfiler:true
//     }
//  
module.exports = function(opts){
    var opts = opts || {};

    // initialize core mml_store
    var mml_store  = new grainstore.MMLStore(opts.redis, opts.grainstore);

    // initialize render cache
    var renderCacheOpts = _.defaults(opts.renderCache || {}, {
      ttl: 60000 // 60 seconds TTL by default
    });
    var render_cache = new RenderCache(renderCacheOpts.ttl, mml_store, opts.mapnik);

    var layergroup_seen = LRU({
      // store no more than these many items in the cache
      max: 8192,
      // consider entries expired after these many milliseconds (60 minutes by default)
      maxAge: 1000*60*60
    });

    // optional log format
    var log_format = opts.hasOwnProperty('log_format') ? opts.log_format
      : '[:req[X-Real-IP] > :req[Host] @ :date] \033[90m:method\033[0m \033[36m:url\033[0m \033[90m:status :response-time ms -> :res[Content-Type]\033[0m';

    // initialize express server
    var app = express.createServer();
    app.enable('jsonp callback');
    app.use(express.bodyParser());

    // Use our step-profiler
    if ( opts.useProfiler ) {
      app.use(function(req, res, next) {
        req.profiler = new Profiler();
        next();
      });
    }

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
    if (!_.isString(opts.base_url) || !_.isFunction(opts.req2params))
      throw new Error("Must initialise Windshaft with a base URL and req2params function");
    if (!_.isString(opts.base_url_notable))
      throw new Error("Must initialise Windshaft with a base_url_notable option");

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
        // called after a layergroup configuration is created
        // @param req request (body is the map configuration)
        // @param layergroup map configuration
        // @param response response object, can be modified
        // @param callback to be called with "err" as first argument
        afterLayergroupCreate: function(req, layergroup, response, callback) {
            callback(null);
        },
        // Set new map style
        // Requires a 'style' parameter containing carto (mapbox.com/carto)
        //
        // @param callback function(err, data) where data has currently NO meaning
        //
        setStyle: function(params, style, version, convert, callback) {
          var mml_builder = mml_store.mml_builder(params, function(err) {
            if (err) callback(err);
            else mml_builder.setStyle(style, callback, version, convert);
          });
        },
        // Delete a map style
        //
        // @param callback function(err, data) where data has currently NO meaning
        //
        delStyle: function(params, callback) {
          var mml_builder = mml_store.mml_builder(params, function(err) {
            if (err) callback(err);
            else mml_builder.delStyle(callback);
          });
        },

        // Enable CORS access by web browsers if set
        doCORS: function(res, extraHeaders) {
          if(opts.enable_cors){
              var baseHeaders = "X-Requested-With, X-Prototype-Version, X-CSRF-Token";
              if(extraHeaders) {
                baseHeaders += ", " + extraHeaders;
              }
              res.header("Access-Control-Allow-Origin", "*");
              res.header("Access-Control-Allow-Headers", baseHeaders);
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
                var next = this;
                mml_builder = mml_store.mml_builder(req.params, function(err) {
                  if (err) { next(err); return; }
                  var convert = req.query.style_convert || req.body.style_convert;
                  mml_builder.getStyle(next, convert);
                });
            },
            function(err, data){
                if (err){
                    var statusCode = 400;
                    // TODO: Find an appropriate statusCode
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
                    var statusCode = 400;
                    // See https://github.com/Vizzuality/Windshaft-cartodb/issues/68
                    var errMsg = err.message ? ( '' + err.message ) : ( '' + err );
                    // TODO: Find an appropriate statusCode
                    app.sendError(res, errMsg.split('\n'), statusCode, 'POST STYLE', err);
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
                    // TODO: find an appropriate statusCode
                    // See https://github.com/Vizzuality/Windshaft-cartodb/issues/68
                    var errMsg = err.message ? ( '' + err.message ) : ( '' + err );
                    app.sendError(res, errMsg.split('\n'), statusCode, 'DELETE STYLE', err);
                } else {
                    render_cache.reset(req);
                    res.send(200);
                }
            }
        );
    });

    // send CORS headers when client send options.
    app.options(app.base_url + '/:z/:x/:y.*', function(req, res, next){
        app.doCORS(res);
        return next();
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
    //
    app.getTileOrGrid = function(req, res){

        var renderer;

        Step(
            function(){
                app.req2params(req, this);
            },
            function(err) {
      if ( req.profiler ) req.profiler.done('req2params');
                if (err) {
console.log("req2params ERROR: "); console.dir(err);
                  throw err;
                }
                app.beforeTileRender(req, res, this);
            },
            function(err, data){
      if ( req.profiler ) req.profiler.done('beforeTileRender');
                if (err) {
console.log("beforeTileRender ERROR: "); console.dir(err);
                  throw err;
                }
                if (req.params.format === 'grid.json' && !req.params.interactivity) {
                  if ( ! req.params.token ) { // token embeds interactivity
                    throw new Error("Missing interactivity parameter");
                  }
                }
                render_cache.getRenderer(req, this);
            },
            function(err, r, is_cached) {
                if ( req.profiler ) req.profiler.done('getRenderer');
                renderer = r;
                if ( is_cached ) {
                  res.header('X-Windshaft-Cache', Date.now() - renderer.ctime);
                }
                if (err) {
console.log("getRenderer ERROR: "); console.dir(err);
                  throw err;
                }
                var my_func = (req.params.format === 'grid.json') ? 'getGrid' : 'getTile';
                renderer[my_func].call(renderer, req.params.z, req.params.x, req.params.y, this);
            },
            function(err, tile, headers) {
                if ( req.profiler ) req.profiler.done('render');
                if (err) {
                  console.log("get{Tile,Grid} ERROR: "); console.dir(err);
                  throw err;
                }
                app.afterTileRender(req, res, tile, headers, this);
            },
            function(err, tile, headers) {
                if ( req.profiler ) req.profiler.done('afterTileRender');
                if ( renderer ) {
                  renderer.release();
                  if ( req.profiler ) req.profiler.done('renderer release');
                }
                if ( req.profiler ) {
                  var report = req.profiler.toString();
                  res.header('X-Tiler-Profiler', report);
                }
                if (err){
                    var statusCode = 400;
                    // See https://github.com/Vizzuality/Windshaft-cartodb/issues/68
                    var errMsg = err.message ? ( '' + err.message ) : ( '' + err );
                    // Find an appropriate statusCode
                    // TODO: turn into a function ?
                    if ( -1 != errMsg.indexOf('permission denied') ) {
                      statusCode = 401;
                    }
                    else if ( -1 != errMsg.indexOf('does not exist') ) {
                      statusCode = 404;
                    }

                    // Rewrite mapnik parsing errors to start with layer number
                    var matches; // = errMsg.match("(.*) in style 'layer([0-9]+)'");
                    if ( matches = errMsg.match("(.*) in style 'layer([0-9]+)'") ) {
                      errMsg = 'style'+matches[2]+': ' + matches[1];
                    }

                    //console.log("[TILE RENDER ERROR] - status code: " + statusCode + "\n" + err);
                    app.sendError(res, {error: errMsg}, statusCode, 'TILE RENDER', err);
                    //res.send({ error: err.message }, statusCode);
                } else {
                    app.sendWithHeaders(res, tile, 200, headers);
                }
            }
        );
    };

    app.get(app.base_url + '/:z/:x/:y.*', function(req, res) {

        app.doCORS(res);

        if ( req.profiler ) req.profiler.done('cors');

        // strip format from end of url and attach to params
        req.params.format = req.params['0'];
        delete req.params['0'];

        // Wrap SQL requests in mapnik format if sent
        if(req.query.sql && req.query.sql !== '') {
            req.query.sql = "(" + req.query.sql.replace(/;\s*$/, '') + ") as cdbq";
        }

        app.getTileOrGrid(req, res);

    });


    app.dumpCacheStats = function() {
      render_cache.dumpStats();
    };

    app.options(app.base_url_notable + '/layergroup', function(req, res, next) {
      app.doCORS(res, "Content-Type");
      return next();
    });

    // Try fetching a grid
    //
    // @param req the request that created the layergroup
    //
    // @param layernum if undefined tries to fetch a tile,
    //                 otherwise tries to fetch a grid from the given layer
    app.tryFetchTileOrGrid = function(req, token, x, y, z, layernum, callback) {

        var customres = {
          header: function() {},
          send: function(body) {
            // NOTE: this dancing here is to support express-2.5.x
            // FIXME: simplify taking second argument as statusCode once we upgrade to express-3.x.x
            var statusCode = typeof(arguments[1]) == 'object' ? arguments[2] : arguments[1];
            if ( statusCode == 200 ) { 
              callback();
            } else {
              callback(new Error(body.error));
            }
          }
        }

        // TODO: deep-clone req, rather than hijack like this ?
        req.params.token = token;
        if ( _.isUndefined(layernum) ) {
          req.params.format = 'png';
        }
        else {
          req.params.layer = layernum;
          req.params.format = 'grid.json';
        }
        req.params.x = x;
        req.params.y = y;
        req.params.z = z;

        app.getTileOrGrid(req, customres);
    };

    // Create a multilayer map, returning a response object
    app.createLayergroup = function(cfg, req, callback) {
        var mml_builder;
        var response = {}
        var token;
        var interactivity = [];

        var testX = 0,
            testY = 0,
            testZ = 30;

        var firstTimeSeen = true; 

        Step(
            function initLayergroup(){
                var next = this;
                //console.log('Configuration:'); console.dir(cfg);
                var version = cfg.version || '1.0.0';
                if ( ! semver.satisfies(version, '~1.0.0') ) {
                  throw new Error("Unsupported layergroup configuration version " + version);
                }
                var sql = [];
                var style = [];
                var style_version = cfg.hasOwnProperty('global_cartocss_version') ? cfg.global_cartocss_version : [];
                if ( cfg.hasOwnProperty('maxzoom') ) {
                  textZ = cfg.maxzoom;
                }
                if ( ! cfg.hasOwnProperty('layers') )
                  throw new Error("Missing layers array from layergroup config");
                for ( var i=0; i<cfg.layers.length; ++i ) {
                  var lyr = cfg.layers[i];
                  if ( ! lyr.hasOwnProperty('options') )
                    throw new Error("Missing options from layer " + i + " of layergroup config");
                  var lyropt = lyr.options;
                  if ( ! lyropt.hasOwnProperty('sql') )
                    throw new Error("Missing sql for layer " + i + " options");
                  // Wrap SQL requests in mapnik format if sent
                  sql.push( "(" + lyropt.sql.replace(/;\s*$/, '') + ") as cdbq");
                  if ( ! lyropt.hasOwnProperty('cartocss') )
                    throw new Error("Missing cartocss for layer " + i + " options");
                  style.push(lyropt.cartocss);
                  if ( _.isArray(style_version) ) {
                    if ( ! lyropt.hasOwnProperty('cartocss_version') ) {
                      throw new Error("Missing cartocss_version for layer " + i + " options");
                    }
                    style_version.push(lyropt.cartocss_version);
                  }
                  // NOTE: interactivity used to be a string as of version 1.0.0
                  if ( _.isArray(lyropt.interactivity) ) {
                    lyropt.interactivity = lyropt.interactivity.join(',');
                  } 
                  interactivity.push(lyropt.interactivity);
                }

                var o = _.clone(req.params);
                o.sql = sql;
                o.style = style;
                o.style_version = style_version;
                o.interactivity = interactivity;
                o.ttl = opts.grainstore.default_layergroup_ttl;

                mml_builder = mml_store.mml_builder(o, function(err) {
                  if (err) { next(err); return; }
                  if ( mml_builder.knownByRedis ) firstTimeSeen = false;
                  next(null, mml_builder.getToken());
                });
            },
            function posLayerCreate(err, ret_token) {
                if (err) throw err;
                token = response.layergroupid = ret_token;
                if ( layergroup_seen.get(token) ) {
                  firstTimeSeen = false;
                } // will save only if successful
                app.afterLayergroupCreate(req, cfg, response, this);
            },
            function tryFetchTile(err){
                if (err) throw err;

                var tryFetchingTile = firstTimeSeen;
                if ( ! tryFetchingTile ) return null;

                var finish = this;
                var next = function(err) {
                  if (! err) finish();
                  else {
                    mml_builder.delStyle(function(e2) {
                      if (e2) console.log("delStyle: " + e2);
                      finish(err);
                    });
                  } 
                }
                app.tryFetchTileOrGrid(req, response.layergroupid, testX, testY, testZ, undefined, next);
            },
            function tryFetchGrid(err){
                if (err) throw err;

                var tryFetchingGrid = firstTimeSeen;
                if ( ! tryFetchingGrid ) return null;

                var interactive = [];
                for ( var i=0; i<interactivity.length; ++i ) {
                  if ( ! _.isUndefined(interactivity[i]) ) interactive.push(i);
                }

                tryFetchingGrid = ( interactive.length > 0 );
                if ( ! tryFetchingGrid ) return null;

                var finish = this;
                var next = function(err) {
                  if ( err ) {
                    mml_builder.delStyle(function(e2) {
                      if (e2) console.log("Deleting style on grid fetching error: " + e2);
                      finish(err);
                    });
                    return;
                  }
                  if ( ! interactive.length ) {
                    finish();
                    return;
                  }
                  var layerId = interactive.shift();
                  app.tryFetchTileOrGrid(req, response.layergroupid, testX, testY, testZ, layerId, next);
                }
                next();
            },
            function doFirstSeenOps(err){
                if ( err ) throw err;
                if ( ! firstTimeSeen ) return null;

                if ( ! err ) {
                  // Marking as seen only because test was successful
                  // See https://github.com/Vizzuality/Windshaft/issues/79
                  layergroup_seen.set(token, 1);
                }

                // dump full layerconfig to logfile
                console.log("Layergroup " + token + ": " + JSON.stringify(cfg));

                return null;

            },
            function finish(err){
                callback(err, response);
            }
        );
    };

    app.post(app.base_url_notable + '/layergroup', function(req, res){
        var mml_builder;

        app.doCORS(res);

        if ( req.profiler ) req.profiler.done('cors');

        Step(
            function setupParams(){
                app.req2params(req, this);
            },
            function initLayergroup(err, data){
                if ( req.profiler ) req.profiler.done('req2params');
                var next = this;
                if (err) throw err;
                if ( ! req.headers['content-type'] || req.headers['content-type'].split(';')[0] != 'application/json' )
                    throw new Error('layergroup POST data must be of type application/json');
                var cfg = req.body; 
                app.createLayergroup(cfg, req, this);
            },
            function finish(err, response){
                if ( req.profiler ) {
                  req.profiler.done('createLayergroup');
                  var report = req.profiler.toString();
                  res.header('X-Tiler-Profiler', report);
                }
                var statusCode = 200;
                if (err){
                    // TODO: change 'error' to a scalar ?
                    response = { errors: [ err.message ] };
                    statusCode = 400;
                    // TODO: Find an appropriate statusCode
                }
                res.send(response, statusCode);
            }
        );
    });

    app.get(app.base_url_notable + '/layergroup', function(req, res){
        var mml_builder;

        Step(
            function setupParams(){
                app.req2params(req, this);
            },
            function initLayergroup(err, data){
                var next = this;
                if (err) throw err;
                if ( ! req.params.config )
                    throw new Error('layergroup GET needs a "config" parameter');
                var cfg = JSON.parse(req.params.config); 
                app.createLayergroup(cfg, req, this);
            },
            function finish(err, response){
                var statusCode = 200;
                if (err){
                    // TODO: change 'error' to a scalar ?
                    response = { errors: [ err.message ] };
                    statusCode = 400;
                    // TODO: Find an appropriate statusCode
                }
                res.send(response, statusCode);
            }
        );
    });

    // Gets a tile for a given token and set of tile ZXY coords. (OSM style)
    app.get(app.base_url_notable + '/layergroup/:token/:z/:x/:y.png', function(req, res) {

      app.doCORS(res);

      if ( req.profiler ) req.profiler.done('cors');

      app.getTileOrGrid(req, res);
    });

    // Gets a grid for a given token, layer and set of tile ZXY coords. (OSM style)
    app.get(app.base_url_notable + '/layergroup/:token/:layer/:z/:x/:y.grid.json', function(req, res) {

      req.params.format = 'grid.json';
      app.doCORS(res);

      if ( req.profiler ) req.profiler.done('cors');

      app.getTileOrGrid(req, res);
    });

    return app;
};
