'use strict';

var mapnik = require('@carto/mapnik');

module.exports = (function (opts) {
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
        req2params: function (req, callback) {
            if (req.query.testUnexpectedError) {
                callback(new Error('test unexpected error'));
                return;
            }

            // this is in case you want to test sql parameters eg ...png?sql=select * from my_table limit 10
            req.params = Object.assign({}, req.params);
            Object.assign(req.params, req.query);

            // increment number of calls counter
            // NOTE: "this" would likely point to the server instance
            this.req2params_calls = this.req2params_calls ? this.req2params_calls + 1 : 1;

            // send the finished req object on
            callback(null, req);
        },
        useProfiler: true,
        statsd: {
            host: 'localhost',
            port: 8125
            // support all allowed node-statsd options
        }

    };

    Object.assign(config, opts || {});

    return config;
})();
