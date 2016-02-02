'use strict';

function EmptyLayerMetadata(types) {
    this._types = types || [];
}

EmptyLayerMetadata.prototype.is = function (type) {
    return this._types.indexOf(type) !== -1;
};

EmptyLayerMetadata.prototype.getMetadata = function (mapConfig, layer, layerId, params, rendererCache, callback) {
    process.nextTick(function() {
        callback(null, {
            stats: []
        });
    });
};

module.exports = EmptyLayerMetadata;
