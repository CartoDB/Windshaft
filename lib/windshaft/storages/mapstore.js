'use strict';

// Map configuration storage

var RedisPool = require('redis-mpool');
var MapConfig = require('../models/mapconfig');

/**
 * @constructor
 * @type {MapStore}
 */
function MapStore (opts) {
    opts = opts || {};
    this._config = Object.assign({
        redis_host: '127.0.0.1',
        redis_port: 6379,
        redis_db: 0,
        redis_key_mapcfg_prefix: 'map_cfg|',
        expire_time: 300, // in seconds (7200 is 5 hours; 300 is 5 minutes)
        pool_max: 50,
        pool_idleTimeout: 10000, // in milliseconds
        pool_reapInterval: 1000, // in milliseconds
        pool_log: false
    }, opts);
    this.redis_pool = this._get('pool');
    if (!this.redis_pool) {
        var redisOpts = {
            host: this._get('redis_host'),
            port: this._get('redis_port'),
            max: this._get('pool_max'),
            idleTimeoutMillis: this._get('pool_idleTimeout'),
            reapIntervalMillis: this._get('pool_reapInterval'),
            log: this._get('pool_log')
        };
        this.redis_pool = new RedisPool(redisOpts);
    }
    this.logger = opts.logger;
}

var o = MapStore.prototype;

/// Internal method: get configuration item
o._get = function (key) {
    return this._config[key];
};

/// Internal method: get redis pool
o._redisPool = function () {
    return this.redis_pool;
};

/// Internal method: run redis command
//
/// @param func - the redis function to execute (uppercase required!)
/// @param args - the arguments for the redis function in an array
///               NOTE: the array will be modified
/// @param callback - function(err,val) function to pass results too.
///
o._redisCmd = function (func, args, callback) {
    const pool = this._redisPool();
    const db = this._get('redis_db');

    pool.acquire(db, (err, client) => {
        if (err) {
            this.log(err, 'adquiring client');
            return callback(err);
        }

        client[func](...args, (err, data) => {
            pool.release(db, client);

            if (err) {
                this.log(err, func, args);
            }

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
o.load = function (id, callback) {
    const key = this._get('redis_key_mapcfg_prefix') + id;
    const exp = this._get('expire_time');

    this._redisCmd('GET', [key], (err, json) => {
        if (err) {
            return callback(err);
        }

        if (!json) {
            const mapConfigError = new Error(`Invalid or nonexistent map configuration token '${id}'`);
            return callback(mapConfigError);
        }

        let mapConfig;
        try {
            const serializedMapConfig = JSON.parse(json);
            mapConfig = MapConfig.create(serializedMapConfig);
        } catch (error) {
            return callback(error);
        }

        // Postpone expiration for the key
        // not waiting for response
        this._redisCmd('EXPIRE', [key, exp]);

        return callback(null, mapConfig);
    });
};

/// API: store map to redis
//
/// @param map MapConfig to store
/// @param callback function(err, id, known) called when save is completed
///
o.save = function (map, callback) {
    const id = map.id();
    const key = this._get('redis_key_mapcfg_prefix') + id;
    const exp = this._get('expire_time');

    this._redisCmd('SETNX', [key, map.serialize()], (err, wasNew) => {
        if (err) {
            return callback(err);
        }

        this._redisCmd('EXPIRE', [key, exp]); // not waiting for response

        return callback(null, id, !wasNew);
    });
};

/// API: delete map from store
//
/// @param map MapConfig to delete from store
/// @param callback function(err, id, known) called when save is completed
///
o.del = function (id, callback) {
    const key = this._get('redis_key_mapcfg_prefix') + id;
    this._redisCmd('DEL', [key], callback);
};

o.log = function (err, command, args = []) {
    if (this.logger) {
        const log = {
            error: err.message,
            command,
            args
        };
        this.logger.error(JSON.stringify(log));
    }
};

module.exports = MapStore;
