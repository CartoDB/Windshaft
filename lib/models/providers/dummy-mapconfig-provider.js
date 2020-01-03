'use strict';

var util = require('util');
var MapStoreMapConfigProvider = require('./mapstore-mapconfig-provider');

function DummyMapConfigProvider (mapConfig, params) {
    MapStoreMapConfigProvider.call(this, undefined, params);

    this.mapConfig = mapConfig;
}

util.inherits(DummyMapConfigProvider, MapStoreMapConfigProvider);

module.exports = DummyMapConfigProvider;

DummyMapConfigProvider.prototype.getMapConfig = function (callback) {
    return callback(null, this.mapConfig, this.params, {});
};
