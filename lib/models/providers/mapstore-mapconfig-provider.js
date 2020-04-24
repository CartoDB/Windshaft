'use strict';

module.exports = class MapStoreMapConfigProvider {
    static createKey (...args) {
        return createKey(...args);
    }

    constructor (mapStore, params) {
        this.mapStore = mapStore;
        this.params = params;
        this.token = params.token;
        this.cacheBuster = params.cache_buster || 0;
    }

    getMapConfig (callback) {
        this.mapStore.load(this.token, (err, mapConfig) => {
            if (err) {
                return callback(err);
            }

            return callback(null, mapConfig, this.params, {});
        });
    }

    getKey () {
        return createKey(this.params);
    }

    getCacheBuster () {
        return this.cacheBuster;
    }

    filter (key) {
        const regex = new RegExp(`^${createKey(this.params, true)}.*`);
        return key && key.match(regex);
    }
};

// Configure bases for cache keys suitable for string interpolation
const baseKey = ctx => `${ctx.dbname}:${ctx.token}`;
const renderKey = ctx => `${baseKey(ctx)}:${ctx.dbuser}:${ctx.format}:${ctx.layer}:${ctx.scale_factor}`;
// Create a string ID/key from a set of params
const defaultParams = {
    dbname: '',
    token: '',
    dbuser: '',
    format: '',
    layer: '',
    scale_factor: 1
};

function createKey (params, useBaseKey) {
    const ctx = Object.assign({}, defaultParams, params);
    return useBaseKey ? baseKey(ctx) : renderKey(ctx);
}
