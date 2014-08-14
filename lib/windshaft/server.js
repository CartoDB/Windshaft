var   express     = require('express')
    , grainstore  = require('grainstore')
    , RedisPool   = require('redis-mpool')
    , RenderCache = require('./render_cache')
    , LocalizedResourcePurger = require('./cache/localized_resource_purger')
    , MapStore    = require('./mapstore')
    , MapConfig   = require('./mapconfig')
    , _           = require('underscore')
    , mapnik      = require('mapnik')
    , Step        = require('step')
    , semver      = require('semver')
    , Profiler    = require('step-profiler')
    , PSQL        = require('cartodb-psql')
    , StatsD      = require('node-statsd').StatsD
;

// Some regular expressions that are better compiled once
var mapnikTokens_RE = /!bbox!|!pixel_width!|!pixel_height!/;


//
// @param opts server options object. Example value:
//     {
//        base_url: '/database/:dbname/table/:table',
//        base_url_notable: '/database/:dbname', // @deprecated
//        base_url_mapconfig: base_url_notable + '/layergroup',
//        req2params: function(req, callback){
//          callback(null,req)
//        },
//        grainstore: {
//          datasource: {
//            user:'postgres', host: '127.0.0.1',
//            port: 5432, geometry_field: 'the_geom_webmercator',
//            srid: 3857
//          }
//        }, //see grainstore npm for other options
//        mapnik: {
//          metatile: 4,
//          bufferSize:64
//        },
//        // http://github.com/sivy/node-statsd/blob/master/lib/statsd.js#L6
//        statsd {,
//          host: 'localhost',
//          port: 8125
//        },
//        renderCache: {
//          ttl: 60000, // seconds
//        },
//        redis: {
//          host: '127.0.0.1', port: 6379
//          // or 'pool', for a pre-configured pooler
//          // with interface of node-redis-mpool
//        },
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
    if ( ! opts.grainstore ) opts.grainstore = {};

    if (!opts.grainstore.mapnik_version) {
        opts.grainstore.mapnik_version = mapnik.versions.mapnik;
    }

    // Be nice and warn if configured mapnik version is != instaled mapnik version
    if (mapnik.versions.mapnik != opts.grainstore.mapnik_version) {
        console.warn('WARNING: detected mapnik version (' + mapnik.versions.mapnik + ')' +
            ' != configured mapnik version (' + opts.grainstore.mapnik_version + ')');
    }

    // Set carto renderer configuration for MMLStore
    if ( ! opts.grainstore.carto_env ) opts.grainstore.carto_env = {};
    var cenv = opts.grainstore.carto_env;
    if ( ! cenv.validation_data ) cenv.validation_data = {};
    if ( ! cenv.validation_data.fonts ) {
      mapnik.register_system_fonts();
      var available_fonts = _.keys(mapnik.fontFiles());
      //console.log("Available fonts: " + available_fonts.toString());
      cenv.validation_data.fonts = available_fonts;
    }

    opts.redis = opts.redis || {};
    var redisPool = (opts.redis && opts.redis.pool)
        ? opts.redis.pool
        : new RedisPool(_.extend(opts.redis, {name: 'windshaft:server'}));

    // initialize core mml_store
    var mml_store_opts = { pool: redisPool }; 
    // force GC off, we'll purge localized resources ourselves
    // NOTE: this is not needed anymore with grainstore-0.18.0
    opts.grainstore.gc_prob = 0;
    var mml_store  = new grainstore.MMLStore(mml_store_opts, opts.grainstore);

    // Setup localized resources purger
    // TODO: allow ttl to be a configuration option !
    var ttl = 60*60*24*1; // 1 day, in seconds
    var purger = new LocalizedResourcePurger(mml_store, ttl);
    purger.start();

    // Initialize statsD client if requested
    var stats_client;
    if ( opts.statsd ) {
      stats_client = new StatsD(opts.statsd);
      stats_client.last_error = { msg:'', count:0 };
      stats_client.socket.on('error', function(err) {
        var last_err = stats_client.last_error;
        var last_msg = last_err.msg;
        var this_msg = ''+err;
        if ( this_msg != last_msg ) {
          console.error("statsd client socket error: " + err);
          stats_client.last_error.count = 1;
          stats_client.last_error.msg = this_msg;
        } else {
            ++last_err.count;
            if ( ! last_err.interval ) {
              //console.log("Installing interval");
              stats_client.last_error.interval = setInterval(function() {
                var count = stats_client.last_error.count;
                if ( count > 1 ) {
                  console.error("last statsd client socket error repeated " + count + " times");
                  stats_client.last_error.count = 1;
                  //console.log("Clearing interval");
                  clearInterval(stats_client.last_error.interval);
                  stats_client.last_error.interval = null;
                } 
              }, 1000);
            }
        }
      });
    }

    // initialize core MapStore
    var map_store_opts = { pool: redisPool };
    if ( opts.grainstore.default_layergroup_ttl ) {
      map_store_opts.expire_time = opts.grainstore.default_layergroup_ttl;
    }
    var map_store  = new MapStore(map_store_opts);

    // initialize render cache
    var renderCacheOpts = _.defaults(opts.renderCache || {}, {
      ttl: 60000 // 60 seconds TTL by default
    });
    var render_cache = new RenderCache(renderCacheOpts.ttl, mml_store, map_store, opts.mapnik);

    // optional log format
    var log_format = opts.hasOwnProperty('log_format') ? opts.log_format
      : '[:req[X-Real-IP] > :req[Host] @ :date] \033[90m:method\033[0m \033[36m:url\033[0m \033[90m:status :response-time ms -> :res[Content-Type]\033[0m';

    // initialize express server
    var app = express.createServer();
    app.enable('jsonp callback');
    app.use(express.bodyParser());

    // Make map storer accessible as part of the app
    app.mapStore = map_store;

    // Use our step-profiler
    if ( opts.useProfiler ) {
      app.use(function(req, res, next) {
        req.profiler = new Profiler({ statsd_client:stats_client });
        next();
      });
    }

    if ( log_format ) {
      var loggerOpts = {
          // Allowing for unbuffered logging is mainly
          // used to avoid hanging during unit testing.
          // TODO: provide an explicit teardown function instead,
          //       releasing any event handler or timer set by
          //       this component.
          buffer: !opts.unbuffered_logging,
          format: log_format
      };
      if ( global.log4js ) {
        app.use(log4js.connectLogger(log4js.getLogger(), _.defaults(loggerOpts, {level:'info'})));
      }
      else {
        app.use(express.logger(loggerOpts));
      }
    }

    //TODO: extract server config to a function
    // take in base url and base req2params from opts or throw exception
    if (!_.isString(opts.base_url) || !_.isFunction(opts.req2params))
      throw new Error("Must initialise Windshaft with a base URL and req2params function");
    if (!_.isString(opts.base_url_notable) && ! _.isString(opts.base_url_mapconfig))
      throw new Error("Must initialise Windshaft with a 'base_url_notable' or 'base_url_mapconfig' option");

    opts = _.defaults(opts, {
      base_url_mapconfig: opts.base_url_notable + '/layergroup'
    });

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

    app.sendResponse = function(res, args) {
      // When using custom results from tryFetch* methods,
      // there is no "req" link in the result object.
      // In those cases we don't want to send stats now
      // as they will be sent at the real end of request
      var req = res.req;

      if (global.environment.api_hostname) {
        res.header('X-Served-By-Host', global.environment.api_hostname);
      }

      if ( req && req.profiler ) {
        res.header('X-Tiler-Profiler', req.profiler.toJSONString());
      }

      res.send.apply(res, args);

      if ( req && req.profiler ) {
        try {
          // May throw due to dns, see
          // See http://github.com/CartoDB/Windshaft/issues/166
          req.profiler.sendStats();
        } catch (err) {
          console.error("error sending profiling stats: " + err);
        }
      }
    };

    // Support both express-2.5 and express-3.0
    if ( express.version.split('.')[0] >= 3 ) {
        app.sendWithHeaders = function(res, what, status, headers) {
            res.set(headers);
            app.sendResponse(res, [what, status]);
        }
    } else {
        app.sendWithHeaders = function(res, what, status, headers) {
            app.sendResponse(res, [what, headers, status]);
        }
    }

    app.findStatusCode = function(err) {
      var statusCode;
      if ( err.http_status ) statusCode = err.http_status;
      else {
        // Find an appropriate statusCode based on message
        statusCode = 400;
        var errMsg = '' + err;
        if ( -1 != errMsg.indexOf('permission denied') ) {
          statusCode = 403;
        }
        else if ( -1 != errMsg.indexOf('authentication failed') ) {
          statusCode = 403;
        }
        else if (errMsg.match(/Postgis Plugin.*[\s|\n].*column.*does not exist/)) {
            statusCode = 400;
        }
        else if ( -1 != errMsg.indexOf('does not exist') ) {
          if ( -1 != errMsg.indexOf(' role ') ) {
            statusCode = 403; // role 'xxx' does not exist
          } else {
            statusCode = 404;
          }
        }
      }
      return statusCode;
    };

    app.sendError = function(res, err, statusCode, label, tolog) {
      var olabel = '[';
      if ( label ) olabel += label + ' ';
      olabel += 'ERROR]';
      if ( ! tolog ) tolog = err;
      var log_msg = olabel + " -- " + statusCode + ": " + tolog;
      //if ( tolog.stack ) log_msg += "\n" + tolog.stack; 
      console.error(log_msg); // use console.log for statusCode != 500 ?
      // If a callback was requested, force status to 200
      if ( res.req ) {
        // NOTE: res.req can be undefined when we fake a call to
        //       ourself from POST to /layergroup
        if ( res.req.query.callback ) statusCode = 200;
      }
      // Strip connection info, if any
      // See https://github.com/CartoDB/Windshaft/issues/173
      err = JSON.stringify(err);
      err = err.replace(/Connection string: '[^']*'\\n/, '');
      // See https://travis-ci.org/CartoDB/Windshaft/jobs/20703062#L1644
      err = err.replace(/is the server.*encountered/im, 'encountered');
      err = JSON.parse(err);

      app.sendResponse(res, [err, statusCode]);
    };

    /*
    * Routing from here
    */

    // simple testable route
    app.get('/', function(req, res){
        if ( req.profiler ) req.profiler.start('windshaft.get_slash');
        app.sendResponse(res, ["JOHN RAMBO"]);
    });

    // version
    app.get('/version', function(req, res){
        if ( req.profiler ) req.profiler.start('windshaft.get_version');
        var version = app.getVersion();
        app.sendResponse(res, [version, 200]);
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

        if ( req.profiler ) req.profiler.start('windshaft.get_style');

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
                    var statusCode = app.findStatusCode(err);
                    //console.log("[GET STYLE ERROR] - status code: " + statusCode + "\n" + err);
                    //app.sendResponse(res, [{error: err.message}, statusCode]);
                    app.sendError(res, {error: err.message}, statusCode, 'GET STYLE', err);
                } else {
                    app.sendResponse(res, [{style: data.style, style_version: data.version}, 200]);
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

        if ( req.profiler ) req.profiler.start('windshaft.post_style');

        app.doCORS(res);

        if ( req.profiler ) req.profiler.done('cors');

        Step(
            function(){
                app.req2params(req, this);
            },
            function(err, data){
                if ( req.profiler ) req.profiler.done('req2params');
                if (err) throw err;
                if (_.isUndefined(req.body) || _.isUndefined(req.body.style)) {
                    var err = 'must send style information';
                    app.sendError(res, {error: err}, 400, 'POST STYLE', err);
                } else {
                    var that = this;
                    app.beforeStateChange(req, function(err, req) {
                        if ( req.profiler ) req.profiler.done('beforeStateChange');
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
                if ( req.profiler ) req.profiler.done('setStyle');
                if (err) throw err;
                app.afterStyleChange(req, data, this);
            },
            function(err, data){
                if ( req.profiler ) {
                  req.profiler.done('afterStyleChange');
                }
                if (err){
                    var statusCode = app.findStatusCode(err);
                    // See https://github.com/Vizzuality/Windshaft-cartodb/issues/68
                    var errMsg = err.message ? ( '' + err.message ) : ( '' + err );
                    app.sendError(res, errMsg.split('\n'), statusCode, 'POST STYLE', err);
                } else {
                    render_cache.reset(req);
                    app.sendResponse(res, [200]);
                }
            }
        );
    });


    // Delete Map Style
    // Triggers state change filter
    app.delete(app.base_url + '/style', function(req, res){

        if ( req.profiler ) req.profiler.start('windshaft.del_style');

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
                    var statusCode = app.findStatusCode(err);
                    // See https://github.com/Vizzuality/Windshaft-cartodb/issues/68
                    var errMsg = err.message ? ( '' + err.message ) : ( '' + err );
                    app.sendError(res, errMsg.split('\n'), statusCode, 'DELETE STYLE', err);
                } else {
                    render_cache.reset(req);
                    app.sendResponse(res, [200]);
                }
            }
        );
    });

    // send CORS headers when client send options.
    app.options(app.base_url + '/:z/:x/:y.*', function(req, res, next){
        app.doCORS(res);
        return next();
    });

    // This function is meant for being called as the very last
    // step by all endpoints serving tiles or grids
    app.finalizeGetTileOrGrid = function(err, req, res, tile, headers) {
      if (err){
          // See https://github.com/Vizzuality/Windshaft-cartodb/issues/68
          var errMsg = err.message ? ( '' + err.message ) : ( '' + err );
          var statusCode = app.findStatusCode(err);

          // Rewrite mapnik parsing errors to start with layer number
          var matches; // = errMsg.match("(.*) in style 'layer([0-9]+)'");
          if ( matches = errMsg.match("(.*) in style 'layer([0-9]+)'") ) {
            errMsg = 'style'+matches[2]+': ' + matches[1];
          }

          app.sendError(res, {error: errMsg}, statusCode, 'TILE RENDER', err);
          if ( stats_client ) {
            stats_client.increment('windshaft.tiles.error');
            if(req.params.format) {
              var f = req.params.format.replace('.', '_');
              if ( stats_client ) {
                stats_client.increment('windshaft.tiles.' + f + '.error');
              }
            }
          }
      } else {
          app.sendWithHeaders(res, tile, 200, headers);
          if ( stats_client ) {
            if(req.params.format) {
              var f = req.params.format.replace('.', '_');
              stats_client.increment('windshaft.tiles.' + f + '.success');
            }
            stats_client.increment('windshaft.tiles.success');
          }
      }

    };

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
    app.getTileOrGrid = function(req, res, callback){

        if ( req.profiler ) req.profiler.start('getTileOrGrid');

        var renderer;

        Step(
            function() {
                app.beforeTileRender(req, res, this);
            },
            function(err, data){
                if ( req.profiler ) req.profiler.done('beforeTileRender');
                if (err) throw err;
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
                if (err) throw err;
                renderer.getTile(+req.params.z, +req.params.x, +req.params.y, this);
            },
            function(err, tile, headers) {
                if ( req.profiler ) req.profiler.done('render-'+req.params.format.replace('.','-'));
                if (err) throw err;
                app.afterTileRender(req, res, tile, headers || {}, this);
            },
            function(err, tile, headers) {
                if ( req.profiler ) req.profiler.done('afterTileRender');
                if ( renderer ) {
                  renderer.release();
                  if ( req.profiler ) req.profiler.done('renderer_release');
                }
                // this should end getTileOrGrid profile task
                if ( req.profiler ) req.profiler.end();
                callback(err, req, res, tile, headers);
            }
        );
    };

    /// Gets attributes for a given layer feature 
    //
    /// Calls req2params, then expects parameters:
    ///
    /// * token - MapConfig identifier
    /// * layer - Layer number
    /// * fid   - Feature identifier
    ///
    /// The referenced layer must have been configured
    /// to allow for attributes fetching.
    /// See https://github.com/CartoDB/Windshaft/wiki/MapConfig-1.1.0
    ///
    /// @param testMode if true generates a call returning requested
    ///                 columns plus the fid column of the first record
    ///                 it is only meant to check validity of configuration
    ///
    app.getFeatureAttributes = function(req, res, testMode) {
        var mapConfig;
        var params;
        Step(
            function (){
                app.req2params(req, this);
            },
            function getMapConfig(err) {
      if ( req.profiler ) req.profiler.done('req2params');
                if (err) throw err;
                params = req.params;
                map_store.load(params.token, this);
            },
            function getPGClient(err, data) {
                if (err) throw err;

                if ( req.profiler ) req.profiler.done('MapStore.load');
                mapConfig = data;

                var dbParams = render_cache.dbParamsFromReqParams(params);
                return new PSQL(dbParams);
            },
            function getAttributes(err, pg) {
                if (err) throw err;

                var layer = mapConfig.getLayer(params.layer);
                if ( ! layer ) {
                  throw new Error("Map " + params.token +
                                  " has no layer number " + params.layer);
                }
                var attributes = layer.options.attributes;
                if ( ! attributes ) {
                  throw new Error("Layer " + params.layer +
                                  " has no exposed attributes");
                }

                // NOTE: we're assuming that the presence of "attributes"
                //       means it is well-formed (should be checked at
                //       MapConfig construction/validation time).

                var fid_col = attributes.id;
                var att_cols = attributes.columns;

                // prepare columns with double quotes
                var quoted_att_cols = _.map(att_cols, function(n) {
                  return pg.quoteIdentifier(n);
                }).join(',');

                if ( testMode )
                  quoted_att_cols += ',' + pg.quoteIdentifier(fid_col);

                var sql = 'select ' + quoted_att_cols +
                  ' from ( ' + layer.options.sql + ' ) as _windshaft_subquery ';
                if ( ! testMode ) sql +=
                  ' WHERE ' + pg.quoteIdentifier(fid_col) + ' = ' + params.fid;
                else sql += ' LIMIT 1';

                // console.log("SQL:  " + sql);

                pg.query(sql, this, true); // use read-only transaction
            },
            function formatAttributes(err, data) {
                if ( req.profiler ) req.profiler.done('getAttributes');
                if (err) throw err;
                if ( data.rows.length != 1 ) {
                  if ( testMode ) return null;
                  else {
                    var err = new Error(data.rows.length +
                        " features in layer " + params.layer +
                        " of map " + params.token +
                        " are identified by fid " + params.fid);
                    if ( ! data.rows.length ) err.http_status = 404;
                    throw err;
                  }
                }
                return data.rows[0];
            },
            function(err, tile) {
                if ( req.profiler ) req.profiler.done('formatAttributes');
                if (err){
                  // See https://github.com/Vizzuality/Windshaft-cartodb/issues/68
                  var errMsg = err.message ? ( '' + err.message ) : ( '' + err );
                  var statusCode = app.findStatusCode(err);
                  app.sendError(res, {error: errMsg}, statusCode, 'GET ATTRIBUTES', err);
                } else {
                  app.sendWithHeaders(res, tile, 200, {});
                }
            }
        );
    };

    app.tryFetchFeatureAttributes = function(req, token, layernum, callback) {

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
        };

        // TODO: deep-clone req, rather than hijack like this ?
        req.params.token = token;
        req.params.layer = layernum;
        //req.params.fid = ;

        app.getFeatureAttributes(req, customres, true);
    };

    app.get(app.base_url + '/:z/:x/:y.*', function(req, res) {

        if ( req.profiler ) req.profiler.start('windshaft.tiles');

        app.doCORS(res);

        if ( req.profiler ) req.profiler.done('cors');

        // strip format from end of url and attach to params
        req.params.format = req.params.splice(0,1)[0];

        // Wrap SQL requests in mapnik format if sent
        if(req.query.sql && req.query.sql !== '') {
            req.query.sql = "(" + req.query.sql.replace(/;\s*$/, '') + ") as cdbq";
        }

        Step(
          function() {
              app.req2params(req, this);
          },
          function(err) {
            if ( req.profiler ) req.profiler.done('req2params');
            if ( err ) throw err;
            app.getTileOrGrid(req, res, this); // legacy get map tile endpoint
          },
          function finalize(err, req_ret, res_ret, tile, headers) {
            app.finalizeGetTileOrGrid(err, req, res, tile, headers);
            return null;
          },
          function finish(err) {
            if ( err ) console.error("windshaft.tiles: " + err);
          }
        );
    });


    app.dumpCacheStats = function() {
      render_cache.dumpStats();
    };

    app.options(app.base_url_mapconfig, function(req, res, next) {
      app.doCORS(res, "Content-Type");
      return next();
    });

    // Try fetching a grid
    //
    // @param req the request that created the layergroup
    //
    // @param layernum if undefined tries to fetch a tile,
    //                 otherwise tries to fetch a grid or torque from the given layer
    app.tryFetchTileOrGrid = function(req, token, x, y, z, format, layernum, callback) {

        var customres = {
          header: function() {},
          send: function(){ }
        };

        // TODO: deep-clone req, rather than hijack like this ?
        req.params.token = token;
        req.params.format = format;
        req.params.layer = layernum;
        req.params.x = x;
        req.params.y = y;
        req.params.z = z;

        Step(
          function tryGet() {
            app.getTileOrGrid(req, customres, this); // tryFetchTileOrGrid
          },
          function checkGet(err) {
            callback(err);
          }
        );
    };

    /// Fetch metadata for a tileset in a MapConfig
    //
    /// @param rendererType a MapConfig renderer type (layer.type in MapConfig spec)
    /// @param layerId layer index within the mapConfig
    /// @param callback function(err, metadata) where metadata format
    ///
    app.fetchTilesetMetadata = function(req, token, rendererType, layerId, callback) {

        req = _.clone(req);
        req.params = _.clone(req.params);
        req.params.token = token;
        req.params.format = rendererType;
        req.params.layer = layerId;

        var renderer;

        Step(
            function(){
                app.req2params(req, this);
            },
            function(err, data){
                if (err) throw err;
                render_cache.getRenderer(req, this);
            },
            function(err, r) {
                if (err) throw err;
                renderer = r;
                renderer.get().getMetadata(this);
            },
            function(err, meta) {
                if ( renderer ) renderer.release();
                callback(err, meta);
            }
        );
    };

    // Create a multilayer map, returning a response object
    app.createLayergroup = function(cfg, req, callback) {

        if ( req.profiler ) req.profiler.start('createLayergroup');

        var response = {};
        var token;

        var testX = 0,
            testY = 0,
            testZ = 30;

        var firstTimeSeen = true; 

        // Inject db parameters into the configuration
        // to ensure getting different identifiers for
        // maps created against different databases
        // or users. See
        // https://github.com/CartoDB/Windshaft/issues/163
        cfg.dbparams = {
          name: req.params.dbname,
          user: req.params.dbuser
        };
        var mapConfig = new MapConfig(cfg);
        var mapID;

        var hasMapnikLayers = false;
        var torqueLayers = [];
        var gridLayers = [];
        var attrLayers = [];

        Step(
            function initLayergroup(){
                var next = this;
                var version = cfg.version || '1.0.0';
                if ( ! semver.satisfies(version, '~1.0.0 || ~1.1.0') ) {
                  throw new Error("Unsupported layergroup configuration version " + version);
                }
                var sql = [];
                if ( cfg.hasOwnProperty('maxzoom') ) {
                  testZ = cfg.maxzoom;
                }
                if ( ! cfg.hasOwnProperty('layers') )
                  throw new Error("Missing layers array from layergroup config");
                for ( var i=0; i<cfg.layers.length; ++i ) {
                  var lyr = cfg.layers[i];
                  if ( ! lyr.hasOwnProperty('options') )
                    throw new Error("Missing options from layer " + i + " of layergroup config");
                  var lyropt = lyr.options;
                  // NOTE: interactivity used to be a string as of version 1.0.0
                  // TODO: find out why this is still needed !
                  if ( _.isArray(lyropt.interactivity) ) {
                    lyropt.interactivity = lyropt.interactivity.join(',');
                  } 
                  if ( ! lyr.type || lyr.type == 'cartodb' ) {
                    hasMapnikLayers = true;
                    if ( lyropt.interactivity ) {
                      gridLayers.push(i);
                    }
                  }
                  else if ( lyr.type == 'torque' ) torqueLayers.push(i);

                  // both 'cartodb' or 'torque' types can have attributes
                  if ( lyropt.attributes ) {
                    attrLayers.push(i);
                    if ( lyropt.sql.match(mapnikTokens_RE) ) {
                      throw new Error("Attribute service cannot be activated on layer " + i + ": using dynamic sql (mapnik tokens)");
                    }
                  }

                }

                if ( req.profiler ) req.profiler.done('layerCheck');

                // will save only if successful
                map_store.save(mapConfig, function(err, id, known) {
                  mapID = id;
                  if ( req.profiler ) req.profiler.done('mapSave');
                  if (err) { next(err); return; }
                  if ( known ) firstTimeSeen = false;
                  next(null, id);
                });
            },
            function tryFetchTile(err, ret_token){
                if (err) throw err;
                token = response.layergroupid = ret_token;

                var tryFetchingTile = firstTimeSeen && hasMapnikLayers;
                if ( ! tryFetchingTile ) return null;

                var finish = this;
                var next = function(err) {
                  if (! err) finish();
                  else {
                    map_store.del(mapID, function(e2) {
                      if (e2) console.error("Deleting MapConfig " + mapID + " on tile fetching error: " + e2);
                      finish(err);
                    });
                  } 
                };
                app.tryFetchTileOrGrid(req, token, testX, testY, testZ, 'png', undefined, next);
            },
            function tryFetchGrid(err){
                if (err) throw err;

                var tryFetchingGrid = firstTimeSeen && gridLayers.length > 0;
                if ( ! tryFetchingGrid ) return null;

                var finish = this;
                var next = function(err) {
                  if ( err ) {
                    map_store.del(mapID, function(e2) {
                      if (e2) console.error("Deleting MapConfig " + mapID + " on grid fetching error: " + e2);
                      finish(err);
                    });
                    return;
                  }
                  if ( ! gridLayers.length ) {
                    finish();
                    return;
                  }
                  var layerId = gridLayers.shift();
                  app.tryFetchTileOrGrid(req, token, testX, testY, testZ, 'grid.json', layerId, next);
                };
                next();
            },
            function tryFetchTorque(err){
                if (err) throw err;

                var tryFetchingTorque = firstTimeSeen && torqueLayers.length;
                if ( ! tryFetchingTorque ) return null;

                var finish = this;
                var next_layer = 0;
                var next = function(err) {
                  if ( err ) {
                    map_store.del(mapID, function(e2) {
                      if (e2) console.error("Deleting MapConfig " + mapID + " on torque tile fetching error: " + e2);
                      finish(err);
                    });
                    return;
                  }
                  if ( next_layer >= torqueLayers.length ) {
                    finish();
                    return;
                  }
                  var layerId = torqueLayers[next_layer++];
                  app.tryFetchTileOrGrid(req, token, testX, testY, testZ, 'json.torque', layerId, next);
                };
                next();
            },
            function tryFetchAttributes(err){
                if (err) throw err;

                var tryFetchingTorque = firstTimeSeen && attrLayers.length;
                if ( ! tryFetchingTorque ) return null;

                var finish = this;
                var next_layer = 0;
                var next = function(err) {
                  if ( err ) {
                    map_store.del(mapID, function(e2) {
                      if (e2) console.error("Deleting MapConfig " + mapID + " on attributes tile fetching error: " + e2);
                      finish(err);
                    });
                    return;
                  }
                  if ( next_layer >= attrLayers.length ) {
                    finish();
                    return;
                  }
                  var layerId = attrLayers[next_layer++];
                  app.tryFetchFeatureAttributes(req, token, layerId, next);
                };
                next();
            },
            function fetchTorqueMetadata(err){
                if (err) throw err;

                if ( ! torqueLayers.length ) return null;

                var finish = this;
                var torque_metadata = {};
                var next_layer = 0;
                var next = function(err, meta) {
                  if ( err || ( next_layer && ! meta ) ) {
                    if ( ! err ) {
                      err = new Error("no metadata returned for torque layer");
                    }
                    map_store.del(mapID, function(e2) {
                      if (e2) console.error("Deleting MapConfig " + mapID + " on torque metadata fetching error: " + e2);
                      finish(err);
                    });
                    return;
                  }
                  if ( next_layer ) {
                    torque_metadata[torqueLayers[next_layer-1]] = meta;
                  }
                  if ( next_layer >= torqueLayers.length ) {
                    response.metadata = response.metadata || {};
                    response.metadata['torque'] = torque_metadata;
                    finish();
                    return;
                  }
                  var layerId = torqueLayers[next_layer++];
                  app.fetchTilesetMetadata(req, response.layergroupid, 'json.torque', layerId, next);
                };
                next();
            },
            function posLayerCreate(err) {
                if (err) throw err;
                app.afterLayergroupCreate(req, cfg, response, this);
            },
            function doFirstSeenOps(err){
                if ( err ) throw err;
                if ( req.profiler ) req.profiler.done('afterLayergroupCreate');
                if ( ! firstTimeSeen ) return null;

                // dump full layerconfig to logfile
                console.log("Layergroup " + token + ": " + JSON.stringify(cfg));

                return null;

            },
            function finish(err){
                if ( req.profiler ) req.profiler.end();
                callback(err, response);
            }
        );
    };

    app.post(app.base_url_mapconfig, function(req, res){

        if ( req.profiler ) req.profiler.start('windshaft.createmap_post');

        app.doCORS(res);

        if ( req.profiler ) req.profiler.done('cors');

        Step(
            function setupParams(){
                app.req2params(req, this);
            },
            function initLayergroup(err, data){
                if ( req.profiler ) req.profiler.done('req2params');
                if (err) throw err;
                if ( ! req.headers['content-type'] || req.headers['content-type'].split(';')[0] != 'application/json' )
                    throw new Error('layergroup POST data must be of type application/json');
                var cfg = req.body; 
                app.createLayergroup(cfg, req, this);
            },
            function finish(err, response){
                if (err){
                    // TODO: change 'error' to a scalar ?
                    response = { errors: [ err.message ] };
                    var statusCode = app.findStatusCode(err);
                    app.sendError(res, response, statusCode, 'POST LAYERGROUP', err);
                } else {
                  app.sendResponse(res, [response, 200]);
                }
            }
        );
    });

    app.get(app.base_url_mapconfig, function(req, res){

        if ( req.profiler ) req.profiler.start('windshaft.createmap_get');

        app.doCORS(res);

        Step(
            function setupParams(){
                app.req2params(req, this);
            },
            function initLayergroup(err, data){
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
                    statusCode = app.findStatusCode(err);
                }
                app.sendResponse(res, [response, statusCode]);
            }
        );
    });

    // Gets a tile for a given token and set of tile ZXY coords. (OSM style)
    app.get(app.base_url_mapconfig + '/:token/:z/:x/:y.:format', function(req, res) {

      if ( req.profiler ) req.profiler.start('windshaft.map_tile');

      app.doCORS(res);

      if ( req.profiler ) req.profiler.done('cors');

      Step(
        function() {
            app.req2params(req, this);
        },
        function(err) {
          if ( req.profiler ) req.profiler.done('req2params');
          if ( err ) throw err;
          app.getTileOrGrid(req, res, this); // map api map tile endpoint
        },
        function finalize(err, req_ret, res_ret, tile, headers) {
          app.finalizeGetTileOrGrid(err, req, res, tile, headers);
          return null;
        },
        function finish(err) {
          if ( err ) console.error("windshaft.tiles: " + err);
        }
      );
    });

    // Gets a tile for a given token, layer set of tile ZXY coords. (OSM style)
    app.get(app.base_url_mapconfig + '/:token/:layer/:z/:x/:y.(:format)', function(req, res) {

      if ( req.profiler ) req.profiler.start('windshaft.maplayer_tile');

      app.doCORS(res);

      if ( req.profiler ) req.profiler.done('cors');

      Step(
        function() {
            app.req2params(req, this);
        },
        function(err) {
          if ( req.profiler ) req.profiler.done('req2params');
          if ( err ) throw err;
          app.getTileOrGrid(req, res, this); // map api map layer tile endpoint
        },
        function finalize(err, req_ret, res_ret, tile, headers) {
          app.finalizeGetTileOrGrid(err, req, res, tile, headers);
          return null;
        },
        function finish(err) {
          if ( err ) console.error("windshaft.tiles: " + err);
        }
      );
    });

    // Gets attributes for a given layer feature 
    app.get(app.base_url_mapconfig + '/:token/:layer/attributes/:fid', function(req, res) {

      if ( req.profiler ) req.profiler.start('windshaft.maplayer_attribute');

      app.doCORS(res);

      if ( req.profiler ) req.profiler.done('cors');

      app.getFeatureAttributes(req, res);

    });

    return app;
};
