'use strict';

function MapConfigProviderProxy (mapConfigProvider, params) {
    this.mapConfigProvider = mapConfigProvider;
    this.params = params;
}

module.exports = MapConfigProviderProxy;

MapConfigProviderProxy.prototype.getMapConfig = function (callback) {
    var self = this;
    this.mapConfigProvider.getMapConfig(function (err, mapConfig, params, context) {
        return callback(err, mapConfig, Object.assign({}, params, self.params), context);
    });
};

MapConfigProviderProxy.prototype.getKey = function () {
    return this.mapConfigProvider.getKey.apply(this);
};

MapConfigProviderProxy.prototype.getCacheBuster = function () {
    return this.mapConfigProvider.getCacheBuster.apply(this);
};

MapConfigProviderProxy.prototype.filter = function () {
    return this.mapConfigProvider.filter.apply(this, arguments);
};

MapConfigProviderProxy.prototype.createKey = function () {
    return this.mapConfigProvider.createKey.apply(this, arguments);
};
