var _ = require('underscore');

module.exports = {
    base_url: '/database/:dbname/table/:table',
    grainstore: {datasource: global.environment.postgres},
    redis: global.environment.redis,
    enable_cors: global.environment.enable_cors,
    req2params: function(req, callback){

        // no default interactivity. to enable specify the database column you'd like to interact with
        req.params.interactivity = null;

        // this is in case you want to test sql parameters eg ...png?sql=select * from my_table limit 10
        req.params =  _.extend({}, req.params);
        _.extend(req.params, req.query);

        // send the finished req object on
        callback(null,req);
    }
};