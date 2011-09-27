module.exports = {
    base_url: '/database/:dbname/table/:table',
    req2params: function(req, callback){req.params.interactivity = null; callback(null,req)},
    grainstore: {datasource: global.environment.postgres},
    redis: global.environment.redis,
    enable_cors: global.environment.enable_cors
};