var _ = require('underscore');
var mapnik = require('mapnik');

module.exports = function(opts) {
    
    var config = {
        base_url: '/database/:dbname/table/:table',
        base_url_notable: '/database/:dbname',
        grainstore: {
          datasource: global.environment.postgres,
          cachedir: global.environment.millstone.cache_basedir,
          mapnik_version: global.environment.mapnik_version || mapnik.versions.mapnik,
          gc_prob: 0 // run the garbage collector at each invocation
        },
        redis: global.environment.redis,
        enable_cors: global.environment.enable_cors,
        unbuffered_logging: true, // for smoother teardown from tests
        log_format: null, // do not log anything
        req2params: function(req, callback){

            if ( req.query.testUnexpectedError ) {
              callback('test unexpected error');
              return;
            }

            // no default interactivity. to enable specify the database column you'd like to interact with
            req.params.interactivity = null;

            // this is in case you want to test sql parameters eg ...png?sql=select * from my_table limit 10
            req.params =  _.extend({}, req.params);
            _.extend(req.params, req.query);

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
        beforeStateChange: function(req, callback) {
            this.beforeStateChangeCalls = this.beforeStateChangeCalls ? this.beforeStateChangeCalls + 1 : 1;
            callback(null, req);
        },
        afterStyleChange: function(req, data, callback) {
            this.afterStyleChangeCalls = this.afterStyleChangeCalls ? this.afterStyleChangeCalls + 1 : 1;
            callback(null, data);
        },
        afterStyleDelete: function(req, data, callback) {
            this.afterStyleDeleteCalls = this.afterStyleDeleteCalls ? this.afterStyleDeleteCalls + 1 : 1;
            callback(null, data);
        },
        afterLayergroupCreate: function(req, cfg, res, callback) {
            res.layercount = cfg.layers.length;
            callback(null);
        },
        useProfiler: true,
        statsd: {
            host: 'localhost',
            port: 8125
            // support all allowed node-statsd options
        }

    }

    _.extend(config,  opts || {});
 
    return config;
}();
