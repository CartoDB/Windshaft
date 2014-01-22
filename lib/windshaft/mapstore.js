// Map configuration storage

var Step       = require('step');
var RedisPool  = require('redis-mpool');
var _          = require('underscore');
var MapConfig  = require('./mapconfig');

/// API: Create MapStore 
//
/// @param opts configuration options
///
function MapStore(opts) {
  this._config = _.defaults(opts, {
    redis_host: "127.0.0.1",
    redis_port: 6379,
    redis_db: 0,
    redis_key_mapcfg_hash: "map|config",
    pool_max: 50,
    pool_idleTimeout: 10000, // in milliseconds
    pool_reapInterval: 1000, // in milliseconds
    pool_log: false
  });
  var redis_opts = {
    host: this._get("redis_host"),
    port: this._get("redis_port"),
    max: this._get("pool_max"),
    idleTimeoutMillis: this._get("pool_idleTimeout"),
    reapIntervalMillis: this._get("pool_reapInterval"),
    log: this._get("pool_log")
  };
  this.redis_pool = new RedisPool(redis_opts);
}

var o = MapStore.prototype;

/// Internal method: get configuration item
o._get = function(key) {
  return this._config[key];
};

/// Internal method: get redis pool
o._redisPool = function() {
  return this.redis_pool;
};

/// Internal method: run redis command
//
/// @param func - the redis function to execute (uppercase required!)
/// @param args - the arguments for the redis function in an array
///               NOTE: the array will be modified
/// @param callback - function(err,val) function to pass results too.
///
o._redisCmd = function(func, args, callback) {
  var client;
  var pool = this._redisPool();
  var db = this._get("redis_db");

  Step(
        function getRedisClient() {
            pool.acquire(db, this);
        },
        function executeQuery(err, data) {
            if ( err ) throw err;
            client = data;
            args.push(this);
            client[func].apply(client, args);
        },
        function releaseRedisClient(err, data) {
            if ( ! _.isUndefined(client) ) pool.release(db, client);
            callback(err, data);
        }
    );

};



/// API: Set configuration variable
//
/// Static method.
/// Configurations should be set before using any
/// other API method.
///
/// @param key configuration key
/// @param value configuration value
///
/// Supported configurations variables:
///   "redis_host" -- IP address, string
///   "redis_port" -- TCP port, number
///
MapStore.setConfig = function(key, value) {
  MapStore._config[key] = value;
};

/// API: Load a saved MapStore object
//
/// Static method
///
/// @param id the MapStore identifier
/// @param callback function(err, mapConfig) callback function
///
o.load = function(id, callback) {
  var that = this;
  var key = this._get("redis_key_mapcfg_hash");
  Step(
    function getRecord() {
      that._redisCmd('HGET', [key, id], this);
    },
    function parseRecord(err, json) {
      if ( err ) throw err;
      if ( ! json ) {
        throw new Error("Unexpected empty config in record '" + key + "'.'" + id + "'");
      }
      return JSON.parse(json);
    },
    function instanciateConfig(err, rec) {
      if ( err ) throw err;
      if ( ! rec.map ) {
        throw new Error("Missing 'map' element in stored MapConfig record keyed with " + id);
      }
      var cfg = rec.map;
      var obj = new MapConfig(cfg);
      if ( obj.id() != id ) { // sanity check
        throw new Error("Mismatched ID for loaded MapStore. Got as " + id + ", computes as " + obj.id());
      }
      return obj;
    },
    function finish(err, obj) {
      callback(err, obj);
    }
  );
};

/// API: garbage collect all expired map configurations
//
/// Static method
///
/// @param ttl time to leave, in seconds
/// @param callback function(err, mapConfig) callback function
///
o.gc = function(ttl, callback) {
  // TODO: implement
};

/// API: store map to redis
//
/// @param map MapConfig to store
/// @param callback function(err, id, known) called when save is completed
///
o.save = function(map, callback) {
  var that = this;
  var key = this._get("redis_key_mapcfg_hash");
  var id = map.id();
  var val = JSON.stringify({
    map: map.obj(),
    accessed_at: Date.now()
  });
  Step(
    function writeRecord() {
      that._redisCmd('HSET', [key, id, val], this);
    },
    function finish(err, wasNew) {
      callback(err, id, !wasNew);
    }
  );
};

/// API: delete map from store
//
/// @param map MapConfig to delete from store
/// @param callback function(err, id, known) called when save is completed
///
o.del = function(id, callback) {
  var that = this;
  var key = this._get("redis_key_mapcfg_hash");
  Step(
    function writeRecord() {
      that._redisCmd('HDEL', [key, id], this);
    },
    function finish(err) {
      callback(err);
    }
  );
};

module.exports = MapStore;
