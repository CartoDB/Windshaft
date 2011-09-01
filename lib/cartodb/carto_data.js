/**
 * User: simon
 * Date: 30/08/2011
 * Time: 21:10
 * Desc: CartoDB helper.
 *       Retrieves dbname (based on subdomain/username)
 *       and geometry type from the redis stores of cartodb
 */

var   RedisPool = require("./redis_pool")
    , _ = require('underscore')
    , Step = require('step');

module.exports = function() {
    var redis_pool = new RedisPool();


    var me = {
        user_metadata_db: 5,
        table_metadata_db: 0,
        user_key: "rails:users:<%= username %>",
        table_key: "rails:<%= database_name %>:<%= table_name %>"
    };



    /**
     * Get the database name for this particular subdomain/username
     *
     * @param req - standard express req object. importantly contains host information
     * @param callback
     */
    me.getDatabase = function(req, callback) {
        // strip subdomain from header host
        var username = req.headers.host.split('.')[0]
        var redisKey = _.template(this.user_key, {username: username});

        this.retrieve(this.user_metadata_db, redisKey, 'database_name', callback);
    };



    /**
     * Get the user id for this particular subdomain/username
     *
     * @param req - standard express req object. importantly contains host information
     * @param callback
     */
    me.getId= function(req, callback) {
        // strip subdomain from header host
        var username = req.headers.host.split('.')[0]
        var redisKey = _.template(this.user_key, {username: username});

        this.retrieve(this.user_metadata_db, redisKey, 'id', callback);
    };



    /**
     * Get the geometry type for this particular table;
     * @param req - standard req object. Importantly contains table and host information
     * @param callback
     */
    me.getGeometryType = function(req, callback){
        var that = this;

        Step(
            function(){
                that.getDatabase(req, this)
            },
            function(err, data){
                if (err) throw err;
                var redisKey = _.template(that.table_key, {database_name: data, table_name: req.params.table});

                that.retrieve(that.table_metadata_db, redisKey, 'the_geom_type', this);
            },
            function(err, data){
                if (err) throw err;
                callback(err, data);
            }
        );
    };


    me.getInfowindow = function(req, callback){
        var that = this;

        Step(
            function(){
                that.getDatabase(req, this);
            },
            function(err, data){
                if (err) throw err;
                var redisKey = _.template(that.table_key, {database_name: data, table_name: req.params.table});
                
                that.retrieve(that.table_metadata_db, redisKey, 'infowindow', this);
            },
            function(err, data){
                if (err) throw err;
                callback(err, data);
            }
        );
    };



    /**
     * Make a HASH data access call to Redis
     *
     * @param redisKey - the base redis key where the metadata hash lives
     * @param hashKey - the specific metadata you want to retrieve
     * @param callback - function to pass metadata too. err,data args
     */
    me.retrieve = function(db, redisKey, hashKey, callback) {
        var redisClient;

        Step(
            function getRedisClient() {
                redis_pool.acquire(db, this);
            },
            function lookupMetadata(err, data) {
                redisClient = data;
                redisClient.HGET(redisKey, hashKey, this);
            },
            function releaseRedisClient(err, data) {
                if (err) throw err;
                redis_pool.release(db, redisClient);
                callback(err, data);
            }
        );
    };

    return me;
}();