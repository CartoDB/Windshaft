var _ = require('underscore');

module.exports = function(opts) {
    
    var config = {
        base_url: '/database/:dbname/table/:table',
        grainstore: {datasource: global.environment.postgres},
        redis: global.environment.redis,
        enable_cors: global.environment.enable_cors,
        unbuffered_logging: true, // for smoother teardown from tests
        req2params: function(req, callback){

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
        }

    }

    _.extend(config,  opts || {});
 
    return config;
}();
