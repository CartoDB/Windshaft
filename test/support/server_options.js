var _ = require('underscore');
var mapnik = require('mapnik');

module.exports = (function(opts) {

    var config = {
        base_url: '/database/:dbname/table/:table',
        base_url_mapconfig: '/database/:dbname/layergroup',
        grainstore: {
          datasource: global.environment.postgres,
          cachedir: global.environment.millstone.cache_basedir,
          mapnik_version: global.environment.mapnik_version || mapnik.versions.mapnik,
          gc_prob: 0 // run the garbage collector at each invocation
        },
        renderer: global.environment.renderer,
        redis: global.environment.redis,
        enable_cors: global.environment.enable_cors,
        unbuffered_logging: true, // for smoother teardown from tests
        log_format: null, // do not log anything
        req2params: function(req, callback){

            if ( req.query.testUnexpectedError ) {
              callback('test unexpected error');
              return;
            }

            // this is in case you want to test sql parameters eg ...png?sql=select * from my_table limit 10
            req.params =  _.extend({}, req.params);
            _.extend(req.params, req.query);

            // increment number of calls counter
            // NOTE: "this" would likely point to the server instance
            this.req2params_calls = this.req2params_calls ? this.req2params_calls + 1 : 1;

            // send the finished req object on
            callback(null,req);
        },
        beforeTileRender: function(req, res, callback) {
            res.header('X-BeforeTileRender', 'called');
            callback(null);
        },
        afterTileRender: function(req, res, tile, headers, callback) {
            res.header('X-AfterTileRender','called');
            headers['X-AfterTileRender2'] = 'called';
            callback(null, tile, headers);
        },
        afterLayergroupCreate: function(req, cfg, res, callback) {
            res.layercount = cfg.layers.length;
            this.afterLayergroupCreateCalls = this.afterLayergroupCreateCalls ? this.afterLayergroupCreateCalls + 1 : 1;
            callback(null);
        },
        useProfiler: true,
        statsd: {
            host: 'localhost',
            port: 8125
            // support all allowed node-statsd options
        }

    };

    _.extend(config,  opts || {});

    return config;
})();
