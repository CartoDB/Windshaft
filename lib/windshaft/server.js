var express = require('express');
var grainstore = require('grainstore');
var RedisPool = require('redis-mpool');
var _ = require('underscore');
var mapnik = require('mapnik');

var MapStore = require('./storages/mapstore');
var RendererCache = require('./cache/renderer_cache');
var RendererStatsReporter = require('./stats/reporter/renderer');
var MapBackend = require('./backends/map');
var StaticMapBackend = require('./backends/static_map');
var Profiler = require('./stats/profiler_proxy');
var StatsClient = require('./stats/client');
var StaticMapsController = require('./controllers/static_maps');
var MapController = require('./controllers/map');


var WELCOME_MSG = "This is the CartoDB Maps API, " +
    "see the documentation at http://docs.cartodb.com/cartodb-platform/maps-api.html";


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
//        renderer: {
//          // function to use when getTile fails in a renderer, it enables modifying the default behaviour
//          onTileErrorStrategy: function(err, tile, headers, stats, format, callback) {
//            // allows to change behaviour based on `err` or `format` for instance
//            callback(err, file, headers, stats);
//          },
//          mapnik: {
//
//          },
//          http: {
//
//          },
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
//        https: {
//          key: fs.readFileSync('test/fixtures/keys/agent2-key.pem'),
//          cert: fs.readFileSync('test/fixtures/keys/agent2-cert.pem')
//        },
//        useProfiler:true
//     }
//
module.exports = function(opts) {
    opts = opts || {};

    opts.grainstore = opts.grainstore || {};
    opts.grainstore.mapnik_version = mapnikVersion(opts);

    validateOptions(opts);

    bootstrapFonts(opts);

    // Make stats client globally accessible
    global.statsClient = StatsClient.getInstance(opts.statsd);

    // initialize express server
    var app = bootstrap(opts);
    addFilters(app, opts);

    var redisPool = makeRedisPool(opts.redis);

    var map_store  = new MapStore({
        pool: redisPool,
        expire_time: opts.grainstore.default_layergroup_ttl
    });

    opts.renderer = opts.renderer || {};

    var RendererFactory = require('./renderers/renderer_factory');
    var rendererFactory = new RendererFactory({
        onTileErrorStrategy: opts.renderer.onTileErrorStrategy,
        mapnik: {
            redisPool: redisPool,
            grainstore: opts.grainstore,
            mapnik: opts.renderer.mapnik || opts.mapnik
        },
        http: opts.renderer.http
    });

    // initialize render cache
    var rendererCacheOpts = _.defaults(opts.renderCache || {}, {
        ttl: 60000, // 60 seconds TTL by default
        statsInterval: 60000 // reports stats every milliseconds defined here
    });
    var rendererCache = new RendererCache(rendererCacheOpts, map_store, rendererFactory);
    var rendererStatsReporter = new RendererStatsReporter(rendererCache, rendererCacheOpts.statsInterval);
    rendererStatsReporter.start();

    // Make map store accessible as part of the app
    app.mapStore = map_store;
    var mapBackend = new MapBackend(rendererCache, map_store);
    var staticMapBackend = new StaticMapBackend(rendererCache);

    app.mapBackend = mapBackend;
    app.staticMapBackend = staticMapBackend;

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

    setupSendWithHeaders(app);

    app.findStatusCode = function(err) {
        var statusCode;
        if ( err.http_status ) {
            statusCode = err.http_status;
        } else {
            statusCode = statusFromErrorMessage('' + err);
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

    /*******************************************************************************************************************
     * Routing
     ******************************************************************************************************************/

    var mapController = new MapController(app, mapBackend, {
        beforeLayergroupCreate: opts.beforeLayergroupCreate,
        afterLayergroupCreate: opts.afterLayergroupCreate
    });
    mapController.register(app);

    var staticMapsController = new StaticMapsController(app, staticMapBackend);
    staticMapsController.register(app);

    // simple testable route
    app.get('/', function(req, res) {
        app.sendResponse(res, [WELCOME_MSG]);
    });

    // version
    app.get('/version', function(req, res) {
        app.sendResponse(res, [app.getVersion(), 200]);
    });

    /*******************************************************************************************************************
     * END Routing
     ******************************************************************************************************************/

    // temporary measure until we upgrade to newer version expressjs so we can check err.status
    app.use(function(err, req, res, next) {
        if (err) {
            if (err.name === 'SyntaxError') {
                app.sendError(res, { errors: [err.name + ': ' + err.message] }, 400, 'JSON', err);
            } else {
                next(err);
            }
        } else {
            next();
        }
    });

    return app;
};

function validateOptions(opts) {
    if (!_.isString(opts.base_url) || !_.isFunction(opts.req2params) || !_.isString(opts.base_url_mapconfig)) {
        throw new Error("Must initialise Windshaft with: 'base_url'/'base_url_mapconfig' URLs and req2params function");
    }

    // Be nice and warn if configured mapnik version is != instaled mapnik version
    if (mapnik.versions.mapnik !== opts.grainstore.mapnik_version) {
        console.warn('WARNING: detected mapnik version (' + mapnik.versions.mapnik + ')' +
            ' != configured mapnik version (' + opts.grainstore.mapnik_version + ')');
    }
}

function makeRedisPool(redisOpts) {
    redisOpts = redisOpts || {};
    return redisOpts.pool || new RedisPool(_.extend(redisOpts, {name: 'windshaft:server'}));
}

function bootstrapFonts(opts) {
    // Set carto renderer configuration for MMLStore
    opts.grainstore.carto_env = opts.grainstore.carto_env || {};
    var cenv = opts.grainstore.carto_env;
    cenv.validation_data = cenv.validation_data || {};
    if ( ! cenv.validation_data.fonts ) {
        mapnik.register_system_fonts();
        mapnik.register_default_fonts();
        cenv.validation_data.fonts = _.keys(mapnik.fontFiles());
    }
}

function bootstrap(opts) {
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

    app.use(function createRequestContext(req, res, next) {
        req.context = req.context || {};
        next();
    });

    // Use our step-profiler
    app.use(function(req, res, next) {
        req.profiler = new Profiler({
            statsd_client: global.statsClient,
            profile: opts.useProfiler
        });
        next();
    });

    setupLogger(app, opts);

    return app;
}

function setupLogger(app, opts) {
    if (opts.log_format) {
        var loggerOpts = {
            // Allowing for unbuffered logging is mainly
            // used to avoid hanging during unit testing.
            // TODO: provide an explicit teardown function instead,
            //       releasing any event handler or timer set by
            //       this component.
            buffer: !opts.unbuffered_logging,
            // optional log format
            format: opts.log_format
        };
        if (global.log4js) {
            app.use(global.log4js.connectLogger(global.log4js.getLogger(), _.defaults(loggerOpts, {level: 'info'})));
        } else {
            app.use(express.logger(loggerOpts));
        }
    }
}

// set default before/after filters if not set in opts object
function addFilters(app, opts) {

    // Extend windshaft with all the elements of the options object
    _.extend(app, opts);

    // filters can be used for custom authentication, caching, logging etc
    _.defaults(app, {
        // Enable CORS access by web browsers if set
        doCORS: function(res, extraHeaders) {
            if (opts.enable_cors) {
                var baseHeaders = "X-Requested-With, X-Prototype-Version, X-CSRF-Token";
                if(extraHeaders) {
                    baseHeaders += ", " + extraHeaders;
                }
                res.header("Access-Control-Allow-Origin", "*");
                res.header("Access-Control-Allow-Headers", baseHeaders);
            }
        },

        getVersion: function() {
            return {
                windshaft: require('../../package.json').version,
                grainstore: grainstore.version(),
                node_mapnik: mapnik.version,
                mapnik: mapnik.versions.mapnik
            };
        }
    });
}

function setupSendWithHeaders(app) {
    // Support both express-2.5 and express-3.0
    if ( express.version.split('.')[0] >= 3 ) {
        app.sendWithHeaders = function(res, what, status, headers) {
            res.set(headers);
            app.sendResponse(res, [what, status]);
        };
    } else {
        app.sendWithHeaders = function(res, what, status, headers) {
            app.sendResponse(res, [what, headers, status]);
        };
    }
}

function statusFromErrorMessage(errMsg) {
    // Find an appropriate statusCode based on message
    var statusCode = 400;
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
    return statusCode;
}

function mapnikVersion(opts) {
    return opts.grainstore.mapnik_version || mapnik.versions.mapnik;
}
