'use strict';

const RedisPool = require('redis-mpool');
const MapConfig = require('../models/mapconfig');

const defaultOptions = {
    redis_host: '127.0.0.1',
    redis_port: 6379,
    redis_db: 0,
    redis_key_mapcfg_prefix: 'map_cfg|',
    expire_time: 300, // in seconds
    pool: undefined, // redis pool client
    pool_max: 50,
    pool_idleTimeout: 10000, // in milliseconds
    pool_reapInterval: 1000, // in milliseconds
    pool_log: false
};

module.exports = class MapStore {
    constructor (options = {}) {
        Object.assign(this, defaultOptions, options);

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

    _key (id) {
        return `${this.redis_key_mapcfg_prefix}${id}`;
    }

    _redisCmd (func, args, callback) {
        const db = this.redis_db;

        this.pool.acquire(db)
            .then(client => {
                client[func](...args, (err, data) => {
                    this.pool.release(db, client)
                        .then(() => {
                            if (err) {
                                return callback(err);
                            }

                            return callback(null, data);
                        })
                        .catch(err => callback(err));
                });
            })
            .catch(err => callback(err));
    }

    // API: Load a saved MapStore object, renewing expiration time
    load (id, callback) {
        const key = this._key(id);

        this._redisCmd('GET', [key], (err, json) => {
            if (err) {
                return callback(err);
            }

            if (!json) {
                return callback(new Error(`Invalid or nonexistent map configuration token '${id}'`));
            }

            let mapConfig;
            try {
                const serializedMapConfig = JSON.parse(json);
                mapConfig = MapConfig.create(serializedMapConfig);
            } catch (error) {
                return callback(error);
            }

            this._redisCmd('EXPIRE', [key, this.expire_time], (err) => {
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
        const key = this._key(id);

        this._redisCmd('SETNX', [key, map.serialize()], (err, wasNew) => {
            if (err) {
                return callback(err);
            }

            this._redisCmd('EXPIRE', [key, this.expire_time], (err) => {
                if (err) {
                    return callback(err);
                }

                return callback(null, id, !wasNew);
            });
        });
    }

    // API: delete map from store
    del (id, callback) {
        const key = this._key(id);
        this._redisCmd('DEL', [key], callback);
    }
};
