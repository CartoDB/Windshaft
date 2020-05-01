'use strict';

module.exports = class MapConfigProviderProxy {
    constructor (mapConfigProvider, params) {
        this.mapConfigProvider = mapConfigProvider;
        this.params = params;
    }

    getMapConfig (callback) {
        this.mapConfigProvider.getMapConfig((err, mapConfig, params, context) => {
            if (err) {
                return callback(err);
            }

            return callback(null, mapConfig, Object.assign({}, params, this.params), context);
        });
    }

    getKey () {
        return this.mapConfigProvider.getKey.apply(this);
    }

    getCacheBuster () {
        return this.mapConfigProvider.getCacheBuster.apply(this);
    }

    filter () {
        return this.mapConfigProvider.filter.apply(this, arguments);
    }

    createKey () {
        return this.mapConfigProvider.createKey.apply(this, arguments);
    }
};
