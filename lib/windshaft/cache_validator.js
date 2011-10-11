//
// this module allows to invalidate cache for a table or check if the cache for a table
// is valid
//
// usage:
//
// Cache.getTimestamp('table_name', function(err, timestamp) {
// });
//
// Cache.setTimestamp('table_name', timestamp, function(err, result) {
// });
//
//

var _          = require('underscore'),
    RedisPool  = require('./redis_pool'),
    Step       = require('step')


function Cache(redis_opts) {

    var redis_pool = new RedisPool(redis_opts);

    var me = {}

    var redis_options = {
        db: 0
    }

    var redisCommand = function(fn, callback) {
        var redis_client;
        Step(
            function getRedisClient(){
                redis_pool.acquire(redis_options.db, this);
            },
            function getDataForTable(err, redis) {
                if (err) throw err;
                redis_client = redis;
                fn(redis_client, this);
            },
            function exit(err, data) {
                if (!_.isUndefined(redis_client))
                    redis_pool.release(redis_options.db, redis_client);
                if (callback) {
                    callback(err, data);
                }
            }
        );
    }

    // get the timestamp for the table
    me.getTimestamp = function(database, table, callback) {
        redisCommand(function(redis, step) {
            redis.GET("cache:" + database + ":" + table + ":updated_at", step);
        }, function(err, t) {
            if(t != null)
                callback(err, parseInt(t, 10));
            else
                callback(err, t);
        });
    }

    me.setTimestamp = function(database, table, timestamp, callback) {
        timestamp = timestamp || new Date().getTime();
        redisCommand(function(redis, step) {
            redis.SET("cache:" + database + ":" + table + ":updated_at", timestamp, step);
        }, callback);
    }

    return me;
};


module.exports = function(redis_opts) {
    return new Cache(redis_opts);
}
