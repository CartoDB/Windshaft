var MapStoreMapConfigProvider = require('./mapstore_mapconfig_provider');

function DummyMapConfigProvider(mapConfig, params) {
    this.mapConfig = mapConfig;
    this.params = params;
    this.token = params.token;
    this.cacheBuster = params.cache_buster || 0;
}

module.exports = DummyMapConfigProvider;

DummyMapConfigProvider.prototype.getMapConfig = function(callback) {
    return callback(null, this.mapConfig, {});
};

DummyMapConfigProvider.prototype.getKey = MapStoreMapConfigProvider.prototype.getKey;

DummyMapConfigProvider.prototype.getCacheBuster = MapStoreMapConfigProvider.prototype.getCacheBuster;

DummyMapConfigProvider.prototype.filter = MapStoreMapConfigProvider.prototype.filter;
