'use strict';

function EmptyLayerMetadata (types) {
    this._types = types || {};
}

EmptyLayerMetadata.prototype.is = function (type) {
    return this._types[type] ? this._types[type] : false;
};

EmptyLayerMetadata.prototype.getMetadata = function (mapConfig, layer, layerId, params, rendererCache, callback) {
    process.nextTick(function () {
        callback(null, {});
    });
};

module.exports = EmptyLayerMetadata;
