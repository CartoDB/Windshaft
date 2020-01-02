'use strict';

function MapnikLayerMetadata () {
    this._types = {
        mapnik: true,
        cartodb: true
    };
}

MapnikLayerMetadata.prototype.is = function (type) {
    return this._types[type] ? this._types[type] : false;
};

MapnikLayerMetadata.prototype.getMetadata = function (mapConfig, layer, layerId, params, rendererCache, callback) {
    return callback(null, { cartocss: layer.options.cartocss });
};

module.exports = MapnikLayerMetadata;
