'use strict';

const MapStoreMapConfigProvider = require('./mapstore-mapconfig-provider');

module.exports = class DummyMapConfigProvider extends MapStoreMapConfigProvider {
    constructor (mapConfig, params) {
        super(undefined, params);
        this.mapConfig = mapConfig;
    }

    getMapConfig (callback) {
        return callback(null, this.mapConfig, this.params, {});
    }
};
