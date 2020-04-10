'use strict';

const RedisPool = require('redis-mpool');
const MapConfig = require('../models/mapconfig');

module.exports = class MapStore {
    constructor (options = {}) {
        Object.assign(this, {
            redis_host: '127.0.0.1',
            redis_port: 6379,
            redis_db: 0,
            redis_key_mapcfg_prefix: 'map_cfg|',
            expire_time: 300, // in seconds
            pool_max: 50,
            pool_idleTimeout: 10000, // in milliseconds
            pool_reapInterval: 1000, // in milliseconds
            pool_log: false
        }, options);

        if (!this.pool) {
            this.pool = new RedisPool({
                host: this.redis_host,
                port: this.redis_port,
                max: this.pool_max,
                idleTimeoutMillis: this.pool_idleTimeout,
                reapIntervalMillis: this.pool_reapInterval,
                log: this.pool_log
            });
        }
    }

    _redisCmd (func, args, callback) {
        const db = this.redis_db;

        this.pool.acquire(db, (err, client) => {
            if (err) {
                return callback(err);
            }

            client[func](...args, (err, data) => {
                this.pool.release(db, client);

                if (err) {
                    return callback(err);
                }

                return callback(null, data);
            });
        });
    }

    // API: Load a saved MapStore object, renewing expiration time
    load (id, callback) {
        const key = this.redis_key_mapcfg_prefix + id;
        const exp = this.expire_time;

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

            this._redisCmd('EXPIRE', [key, exp], (err) => {
                if (err) {
                    return callback(err);
                }

                return callback(null, mapConfig);
            });
        });
    }

    // API: store map to redis
    save (map, callback) {
        const id = map.id();
        const key = this.redis_key_mapcfg_prefix + id;
        const exp = this.expire_time;

        this._redisCmd('SETNX', [key, map.serialize()], (err, wasNew) => {
            if (err) {
                return callback(err);
            }

            this._redisCmd('EXPIRE', [key, exp], (err) => {
                if (err) {
                    return callback(err);
                }

                return callback(null, id, !wasNew);
            });
        });
    }

    // API: delete map from store
    del (id, callback) {
        const key = this.redis_key_mapcfg_prefix + id;
        this._redisCmd('DEL', [key], callback);
    }
};
