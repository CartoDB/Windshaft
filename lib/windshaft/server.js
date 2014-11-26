var   express     = require('express')
    , grainstore  = require('grainstore')
    , RedisPool   = require('redis-mpool')
    , LocalizedResourcePurger = require('./cache/localized_resource_purger')
    , MapStore    = require('./mapstore')
    , MapConfig   = require('./mapconfig')
    , _           = require('underscore')
    , mapnik      = require('mapnik')
    , Step        = require('step')
    , semver      = require('semver')
    , Profiler    = require('./stats/profiler_proxy')
    , PSQL        = require('cartodb-psql')
    , StatsClient = require('./stats/client')
;

// Some regular expressions that are better compiled once
var mapnikTokens_RE = /!bbox!|!pixel_width!|!pixel_height!/;

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
      mapnik.register_default_fonts();
      var available_fonts = _.keys(mapnik.fontFiles());
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

    // initialize render cache
    var RenderCache = require('./render_cache');
    var renderCacheOpts = _.defaults(opts.renderCache || {}, {
        ttl: 60000, // 60 seconds TTL by default
        statsInterval: 60000 // reports stats every milliseconds defined here
    });
    var render_cache = new RenderCache(renderCacheOpts, mml_store, map_store, opts.mapnik);

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
          var matches; // = errMsg.match("(.*) in style 'layer([0-9]+)'");
          if ( matches = errMsg.match("(.*) in style 'layer([0-9]+)'") ) {
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

        req.profiler.start('getTileOrGrid');

        var renderer;

        Step(
            function() {
                app.beforeTileRender(req, res, this);
            },
            function(err, data){
                req.profiler.done('beforeTileRender');
                if (err) throw err;
                if (req.params.format === 'grid.json' && !req.params.interactivity) {
                  if ( ! req.params.token ) { // token embeds interactivity
                    throw new Error("Missing interactivity parameter");
                  }
                }
                render_cache.getRenderer(req, this);

            },
            function(err, r, is_cached) {
                req.profiler.done('getRenderer');
                renderer = r;
                if ( is_cached ) {
                  res.header('X-Windshaft-Cache', Date.now() - renderer.ctime);
                }
                if (err) throw err;
                renderer.getTile(+req.params.z, +req.params.x, +req.params.y, this);
            },
            function(err, tile, headers) {
                req.profiler.done('render-'+req.params.format.replace('.','-'));
                if (err) throw err;
                app.afterTileRender(req, res, tile, headers || {}, this);
            },
            function(err, tile, headers) {
                req.profiler.done('afterTileRender');
                if ( renderer ) {
                  renderer.release();
                  req.profiler.done('renderer_release');
                }
                // this should end getTileOrGrid profile task
                req.profiler.end();
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
                req.profiler.done('req2params');
                if (err) throw err;
                params = req.params;
                map_store.load(params.token, this);
            },
            function getPGClient(err, data) {
                if (err) throw err;

                req.profiler.done('MapStore.load');
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
                req.profiler.done('getAttributes');
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
                req.profiler.done('formatAttributes');
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
                if ( ! semver.satisfies(version, '>= 1.0.0 < 1.3.0') ) {
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

                req.profiler.done('layerCheck');

                // will save only if successful
                map_store.save(mapConfig, function(err, id, known) {
                  mapID = id;
                  req.profiler.done('mapSave');
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
                req.profiler.done('afterLayergroupCreate');
                if ( ! firstTimeSeen ) return null;

                // dump full layerconfig to logfile
                console.log("Layergroup " + token + ": " + JSON.stringify(cfg));

                return null;

            },
            function finish(err){
                req.profiler.end();
                callback(err, response);
            }
        );
    };

    /*******************************************************************************************************************
     * Routing
     ******************************************************************************************************************/

    // simple testable route
    app.get('/', function(req, res) {
        app.sendResponse(res, [WELCOME_MSG]);
    });

    // version
    app.get('/version', function(req, res) {
        app.sendResponse(res, [app.getVersion(), 200]);
    });

    var MapController = require('./controllers/map'),
        mapController = new MapController(app);
    mapController.register(app);

    app.post(app.base_url_mapconfig, function(req, res){

        req.profiler.start('windshaft.createmap_post');

        app.doCORS(res);

        Step(
            function setupParams(){
                app.req2params(req, this);
            },
            function initLayergroup(err, data){
                req.profiler.done('req2params');
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

        req.profiler.start('windshaft.createmap_get');

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

      req.profiler.start('windshaft.map_tile');

      app.doCORS(res);

      Step(
        function() {
            app.req2params(req, this);
        },
        function(err) {
          req.profiler.done('req2params');
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

      req.profiler.start('windshaft.maplayer_tile');

      app.doCORS(res);

      Step(
        function() {
            app.req2params(req, this);
        },
        function(err) {
          req.profiler.done('req2params');
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

    /************************
     * Deprecated controllers
     ***********************/

    var TilesController = require('./controllers/tiles'),
        tilesController = new TilesController(app);
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
