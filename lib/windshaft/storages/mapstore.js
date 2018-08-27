// Map configuration storage

var step       = require('step');
var RedisPool  = require('redis-mpool');
var _          = require('underscore');
var MapConfig  = require('../models/mapconfig');
var assert = require('assert');

/**
 * @constructor
 * @type {MapStore}
 */
function MapStore(opts) {
  opts = opts || {};
  this._config = _.defaults(opts, {
    redis_host: "127.0.0.1",
    redis_port: 6379,
    redis_db: 0,
    redis_key_mapcfg_prefix: "map_cfg|",
    expire_time: 300, // in seconds (7200 is 5 hours; 300 is 5 minutes)
    pool_max: 50,
    pool_idleTimeout: 10000, // in milliseconds
    pool_reapInterval: 1000, // in milliseconds
    pool_log: false
  });
  this.redis_pool = this._get("pool");
  if ( ! this.redis_pool ) {
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
  const pool = this._redisPool();
  const db = this._get("redis_db");

  pool.acquire(db, (err, client) => {
    if (err) {
      return callback(err);
    }

    client[func](...args, (err, data) => {
      pool.release(db, client);

      if (callback) {
        if (err) {
          return callback(err);
        }

        return callback(null, data);
      }
    });

  });
};

/// API: Load a saved MapStore object, renewing expiration time
//
/// Static method
///
/// @param id the MapStore identifier
/// @param callback function(err, mapConfig) callback function
///
o.load = function(id, callback) {
  var that = this;
  var key = this._get("redis_key_mapcfg_prefix") + id;
  var exp = this._get("expire_time");
  step(
    function getRecord() {
      that._redisCmd('GET', [key], this);
    },
    function parseRecord(err, json) {
      assert.ifError(err);

      if ( ! json ) {
        throw new Error("Invalid or nonexistent map configuration token '" + id + "'");
      }
      return JSON.parse(json);
    },
    function instantiateConfig(err, serializedMapConfig) {
      assert.ifError(err);

      var obj = MapConfig.create(serializedMapConfig);
      return obj;
    },
    function finish(err, obj) {
      if ( ! err ) {
        // Postpone expiration for the key
        that._redisCmd('EXPIRE', [key, exp]); // not waiting for response
      }
      callback(err, obj);
    }
  );
};

/// API: store map to redis
//
/// @param map MapConfig to store
/// @param callback function(err, id, known) called when save is completed
///
o.save = function(map, callback) {
  var that = this;
  var id = map.id();
  var key = this._get("redis_key_mapcfg_prefix") + id;
  var exp = this._get("expire_time");
  step(
    function writeRecord() {
      that._redisCmd('SETNX', [key, map.serialize()], this);
    },
    function finish(err, wasNew) {
      if ( ! err ) {
        that._redisCmd('EXPIRE', [key, exp]); // not waiting for response
      }
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
  var key = this._get("redis_key_mapcfg_prefix") + id;
  step(
    function writeRecord() {
      that._redisCmd('DEL', [key], this);
    },
    function finish(err) {
      callback(err);
    }
  );
};


module.exports = MapStore;
