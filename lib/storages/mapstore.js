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

        this.logger = options.logger;
    }

    _get (key) {
        return this[key];
    }

    _redisPool () {
        return this.redis_pool;
    }

    _redisCmd (func, args, callback) {
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
    }

    // API: Load a saved MapStore object, renewing expiration time
    load (id, callback) {
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
    }

    // API: store map to redis
    save (map, callback) {
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
    }

    // API: delete map from store
    del (id, callback) {
        const key = this._get('redis_key_mapcfg_prefix') + id;
        this._redisCmd('DEL', [key], callback);
    }

    log (err, command, args = []) {
        if (this.logger) {
            const log = {
                error: err.message,
                command,
                args
            };
            this.logger.error(JSON.stringify(log));
        }
    }
};
