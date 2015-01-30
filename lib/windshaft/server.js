var express = require('express');
var grainstore = require('grainstore');
var RedisPool = require('redis-mpool');
var LocalizedResourcePurger = require('./cache/localized_resource_purger');
var MapStore = require('./storages/mapstore');
var MapConfig = require('./models/mapconfig');
var _ = require('underscore');
var mapnik = require('mapnik');
var Step = require('step');
var Profiler = require('./stats/profiler_proxy');
var StatsClient = require('./stats/client');


// Some regular expressions that are better compiled once
var mapnikTokens_RE = /!bbox!|!scale_denominator!|!pixel_width!|!pixel_height!/;

var WELCOME_MSG = "This is the CartoDB Maps API, see the documentation at http://docs.cartodb.com/cartodb-platform/maps-api.html";


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
//        https: {
//          key: fs.readFileSync('test/fixtures/keys/agent2-key.pem'),
//          cert: fs.readFileSync('test/fixtures/keys/agent2-cert.pem')
//        },
//        useProfiler:true
//     }
//  
module.exports = function(opts){
    opts = opts || {};
    opts.grainstore = opts.grainstore || {};

    opts.grainstore.mapnik_version = opts.grainstore.mapnik_version || mapnik.versions.mapnik;

    // Be nice and warn if configured mapnik version is != instaled mapnik version
    if (mapnik.versions.mapnik !== opts.grainstore.mapnik_version) {
        console.warn('WARNING: detected mapnik version (' + mapnik.versions.mapnik + ')' +
            ' != configured mapnik version (' + opts.grainstore.mapnik_version + ')');
    }

    // Set carto renderer configuration for MMLStore
    opts.grainstore.carto_env = opts.grainstore.carto_env || {};
    var cenv = opts.grainstore.carto_env;
    cenv.validation_data = cenv.validation_data || {};
    if ( ! cenv.validation_data.fonts ) {
      mapnik.register_system_fonts();
      mapnik.register_default_fonts();
      cenv.validation_data.fonts = _.keys(mapnik.fontFiles());
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
    var ONE_DAY_IN_SECONDS = 60*60*24;
    var purger = new LocalizedResourcePurger(mml_store, ONE_DAY_IN_SECONDS);
    purger.start();

    // Initializes an stats client
    var statsClient = StatsClient.getInstance(opts.statsd);

    // Make stats client globally accessible
    global.statsClient = statsClient;

    // initialize core MapStore
    var map_store_opts = { pool: redisPool };
    if ( opts.grainstore.default_layergroup_ttl ) {
      map_store_opts.expire_time = opts.grainstore.default_layergroup_ttl;
    }
    var map_store  = new MapStore(map_store_opts);

    var RendererFactory = require('./renderers/renderer_factory');

    var rendererFactory = new RendererFactory({
        mapnik: {
            opts: opts.mapnik,
            mmlStore: mml_store
        },
        http: opts.renderer && opts.renderer.http || {}
    });

    // initialize render cache
    var RenderCache = require('./renderers/render_cache');
    var renderCacheOpts = _.defaults(opts.renderCache || {}, {
        ttl: 60000, // 60 seconds TTL by default
        statsInterval: 60000 // reports stats every milliseconds defined here
    });
    var render_cache = new RenderCache(renderCacheOpts, mml_store, map_store, opts.mapnik, rendererFactory);

    // optional log format
    var log_format = opts.hasOwnProperty('log_format') ? opts.log_format
      : '[:req[X-Real-IP] > :req[Host] @ :date] \033[90m:method\033[0m \033[36m:url\033[0m \033[90m:status :response-time ms -> :res[Content-Type]\033[0m';

    // initialize express server
    var app;
    if (_.isObject(opts.https)) {
      // use https if possible
      app = express.createServer(opts.https);
    } else {
      // fall back to http by default
      app = express.createServer();
    }
    app.enable('jsonp callback');
    app.use(express.bodyParser());

    // Make map storer accessible as part of the app
    app.mapStore = map_store;

    // Use our step-profiler
    app.use(function(req, res, next) {
        req.profiler = new Profiler({
            statsd_client: statsClient,
            profile: opts.useProfiler
        });
        next();
    });

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
    if (!_.isString(opts.base_url) || !_.isFunction(opts.req2params)) {
      throw new Error("Must initialise Windshaft with a base URL and req2params function");
    }
    if (!_.isString(opts.base_url_notable) && ! _.isString(opts.base_url_mapconfig)) {
      throw new Error("Must initialise Windshaft with a 'base_url_notable' or 'base_url_mapconfig' option");
    }

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
        // called before a layergroup configuration is created
        // it allows to modify the configuration
        // @param req request (body is the map configuration)
        // @param requestMapConfig layergroup map configuration
        // @param callback to be called with "err" as first argument
        beforeLayergroupCreate: function(req, requestMapConfig, callback) {
            callback(null, requestMapConfig);
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
            if (err) {
                callback(err);
            } else {
                mml_builder.setStyle(style, callback, version, convert);
            }
          });
        },
        // Delete a map style
        //
        // @param callback function(err, data) where data has currently NO meaning
        //
        delStyle: function(params, callback) {
          var mml_builder = mml_store.mml_builder(params, function(err) {
            if (err) {
                callback(err);
            } else {
                mml_builder.delStyle(callback);
            }
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

      if (global.environment && global.environment.api_hostname) {
        res.header('X-Served-By-Host', global.environment.api_hostname);
      }

      if (req && req.params && req.params.dbhost) {
        res.header('X-Served-By-DB-Host', req.params.dbhost);
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
      if ( err.http_status ) {
          statusCode = err.http_status;
      } else {
        // Find an appropriate statusCode based on message
        statusCode = 400;
        var errMsg = '' + err;
        if ( -1 !== errMsg.indexOf('permission denied') ) {
          statusCode = 403;
        }
        else if ( -1 !== errMsg.indexOf('authentication failed') ) {
          statusCode = 403;
        }
        else if (errMsg.match(/Postgis Plugin.*[\s|\n].*column.*does not exist/)) {
            statusCode = 400;
        }
        else if ( -1 !== errMsg.indexOf('does not exist') ) {
          if ( -1 !== errMsg.indexOf(' role ') ) {
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
      if ( label ) {
          olabel += label + ' ';
      }
      olabel += 'ERROR]';
      if ( ! tolog ) {
          tolog = err;
      }
      var log_msg = olabel + " -- " + statusCode + ": " + tolog;
      //if ( tolog.stack ) log_msg += "\n" + tolog.stack; 
      console.error(log_msg); // use console.log for statusCode != 500 ?
      // If a callback was requested, force status to 200
      if ( res.req ) {
        // NOTE: res.req can be undefined when we fake a call to
        //       ourself from POST to /layergroup
        if ( res.req.query.callback ) {
            statusCode = 200;
        }
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

    app.dumpCacheStats = function() {
        render_cache.dumpStats();
    };

    // This function is meant for being called as the very last
    // step by all endpoints serving tiles or grids
    app.finalizeGetTileOrGrid = function(err, req, res, tile, headers) {
        var supportedFormats = {
            grid_json: true,
            json_torque: true,
            png: true
        };

        var formatStat;
        if (req.params.format) {
            var format = req.params.format.replace('.', '_');
            if (supportedFormats[format]) {
                formatStat = format;
            }
        }

      if (err){
          // See https://github.com/Vizzuality/Windshaft-cartodb/issues/68
          var errMsg = err.message ? ( '' + err.message ) : ( '' + err );
          var statusCode = app.findStatusCode(err);

          // Rewrite mapnik parsing errors to start with layer number
          var matches = errMsg.match("(.*) in style 'layer([0-9]+)'");
          if (matches) {
            errMsg = 'style'+matches[2]+': ' + matches[1];
          }

          app.sendError(res, {error: errMsg}, statusCode, 'TILE RENDER', err);
          statsClient.increment('windshaft.tiles.error');
            if (formatStat) {
                statsClient.increment('windshaft.tiles.' + formatStat + '.error');
            }
      } else {
          app.sendWithHeaders(res, tile, 200, headers);
          statsClient.increment('windshaft.tiles.success');
            if (formatStat) {
                statsClient.increment('windshaft.tiles.' + formatStat + '.success');
            }
      }

    };

    var MapBackend = require('./backends/map');
    var mapBackend = new MapBackend(app, render_cache, map_store);

    var MapValidatorBackend = require('./backends/map_validator');
    var mapValidatorBackend = new MapValidatorBackend(mapBackend);

    // Create a multilayer map, returning a response object
    app.createLayergroup = function(requestMapConfig, req, callback) {

        req.profiler.start('createLayergroup');

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
        requestMapConfig.dbparams = {
          name: req.params.dbname,
          user: req.params.dbuser
        };

        var mapConfig;
        var mapID;

        var hasMapnikLayers = false;
        var torqueLayers = [];
        var gridLayers = [];
        var gridLayerIndex = 0;
        var attrLayers = [];

        Step(
            function preLayerCreate() {
                app.beforeLayergroupCreate(req, requestMapConfig, this);
            },
            function initLayergroup(err, layergroupMapConfig) {
                if (err) {
                    throw err;
                }

                mapConfig = new MapConfig(layergroupMapConfig);

                var next = this;

                mapConfig.getLayers().forEach(function(lyr, i) {
                  if ( ! lyr.hasOwnProperty('options') ) {
                    throw new Error("Missing options from layer " + i + " of layergroup config");
                  }

                  var lyropt = lyr.options;

                  // NOTE: interactivity used to be a string as of version 1.0.0
                  // TODO: find out why this is still needed !
                  if ( _.isArray(lyropt.interactivity) ) {
                    lyropt.interactivity = lyropt.interactivity.join(',');
                  }

                  var layerType = mapConfig.layerType(i);

                  if (layerType === 'mapnik') {
                    hasMapnikLayers = true;
                    if ( lyropt.interactivity ) {
                      // -------------------------------------------------------------------------------
                      // ### Why not use `i` variable for grid layers as in `attributes` or `torque` ###
                      // -------------------------------------------------------------------------------
                      // It's expected that all cartodb/mapnik layers start from index 0 and layers with a different
                      // type are always at the end of the layers list.
                      // If that's not the case, for instance with a mapconfig with layers [torque:0,mapnik:0,mapnik:1]
                      // using `i` variable we would set gridLayers=[1,2] but the internal data structures will have
                      // [mapnik:0,mapnik:1], so when trying to get the grid for mapnik:0 it will get the interactivity
                      // for mapnik:1 because we said it was in index=1, and when trying to get the grid for mapnik:1 it
                      // will fail because it will try to reach index=2 in the internal data structure, which actually
                      // has only two elements. That's why we set the grid layer in a zero based index.
                      // This change ensures all previous scenarios where mapnik layers were the first elements of the
                      // list will continue working as before because all mapnik/cartodb layers will start from index=0.
                      gridLayers.push(gridLayerIndex);
                    }
                    // If mapnik/cartodb layer has no interactivity we want to skip to next one as well
                    gridLayerIndex++;
                  } else if (layerType === 'torque') {
                      torqueLayers.push(i);
                  }

                  // both 'cartodb' or 'torque' types can have attributes
                  if ( lyropt.attributes ) {
                    attrLayers.push(i);
                    if ( lyropt.sql.match(mapnikTokens_RE) ) {
                      throw new Error("Attribute service cannot be activated on layer " + i + ": using dynamic sql (mapnik tokens)");
                    }
                  }
                });

                // will save only if successful
                map_store.save(mapConfig, function(err, id, known) {
                  mapID = id;
                  req.profiler.done('mapSave');
                  if (err) {
                      return next(err);
                  }
                  if ( known ) {
                      firstTimeSeen = false;
                  }
                  next(null, id);
                });
            },
            function tryFetchTile(err, ret_token){
                if (err) {
                    throw err;
                }
                token = response.layergroupid = ret_token;

                var tryFetchingTile = firstTimeSeen && hasMapnikLayers;
                if ( ! tryFetchingTile ) {
                    return null;
                }

                var finish = this;
                var next = function(err) {
                  if (! err) {
                      finish();
                  } else {
                    map_store.del(mapID, function(e2) {
                      if (e2) {
                          console.error("Deleting MapConfig " + mapID + " on tile fetching error: " + e2);
                      }
                      finish(err);
                    });
                  } 
                };
                mapValidatorBackend.tryFetchTileOrGrid(req, token, testX, testY, testZ, 'png', undefined, next);
            },
            function tryFetchGrid(err){
                if (err) {
                    throw err;
                }

                var tryFetchingGrid = firstTimeSeen && gridLayers.length > 0;
                if ( ! tryFetchingGrid ) {
                    return null;
                }

                var finish = this;
                var next = function(err) {
                  if ( err ) {
                    map_store.del(mapID, function(e2) {
                      if (e2) {
                          console.error("Deleting MapConfig " + mapID + " on grid fetching error: " + e2);
                      }
                      finish(err);
                    });
                    return;
                  }
                  if ( ! gridLayers.length ) {
                    finish();
                    return;
                  }
                  var layerId = gridLayers.shift();
                  mapValidatorBackend.tryFetchTileOrGrid(req, token, testX, testY, testZ, 'grid.json', layerId, next);
                };
                next();
            },
            function tryFetchTorque(err){
                if (err) {
                    throw err;
                }

                var tryFetchingTorque = firstTimeSeen && torqueLayers.length;
                if ( ! tryFetchingTorque ) {
                    return null;
                }

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
                  mapValidatorBackend.tryFetchTileOrGrid(req, token, testX, testY, testZ, 'json.torque', layerId, next);
                };
                next();
            },
            function tryFetchAttributes(err){
                if (err) {
                    throw err;
                }

                var tryFetchingTorque = firstTimeSeen && attrLayers.length;
                if ( ! tryFetchingTorque ) {
                    return null;
                }

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
                  mapValidatorBackend.tryFetchFeatureAttributes(req, token, layerId, next);
                };
                next();
            },
            function fetchTorqueMetadata(err){
                if (err) {
                    throw err;
                }

                if ( ! torqueLayers.length ) {
                    return null;
                }

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
                  mapBackend.fetchTilesetMetadata(req, response.layergroupid, 'json.torque', layerId, next);
                };
                next();
            },
            function posLayerCreate(err) {
                if (err) {
                    throw err;
                }
                app.afterLayergroupCreate(req, mapConfig.obj(), response, this);
            },
            function finish(err) {
                if (!err) {
                    req.profiler.done('afterLayergroupCreate');
                }
                req.profiler.end();
                callback(err, response);
            }
        );
    };

    /*******************************************************************************************************************
     * Routing
     ******************************************************************************************************************/

    var MapController = require('./controllers/map'),
        mapController = new MapController(app, mapBackend);
    mapController.register(app);

    var StaticMapsController = require('./controllers/static_maps'),
        staticMapsController = new StaticMapsController(app, render_cache);
    staticMapsController.register(app);

    // simple testable route
    app.get('/', function(req, res) {
        app.sendResponse(res, [WELCOME_MSG]);
    });

    // version
    app.get('/version', function(req, res) {
        app.sendResponse(res, [app.getVersion(), 200]);
    });

    /************************
     * Deprecated controllers
     ***********************/

    var TilesController = require('./controllers/tiles'),
        tilesController = new TilesController(app, mapBackend);
    tilesController.register(app);

    var TilesStyleController = require('./controllers/tiles_style'),
        tilesStyleController = new TilesStyleController(app, render_cache, mml_store);
    tilesStyleController.register(app);

    /*******************************************************************************************************************
     * END Routing
     ******************************************************************************************************************/

    // temporary measure until we upgrade to newer version expressjs so we can check err.status
    app.use(function(err, req, res, next) {
        if (err) {
            if (err.name === 'SyntaxError') {
                app.sendError(res, {error: err.name, msg: err.message}, 400, 'JSON', err);
            } else {
                next(err);
            }
        } else {
            next();
        }
    });

    return app;
};
