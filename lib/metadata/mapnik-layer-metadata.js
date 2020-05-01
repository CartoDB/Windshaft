'use strict';

module.exports = class MapnikLayerMetadata {
    constructor () {
        this._types = {
            mapnik: true,
            cartodb: true
        };
    }

    is (type) {
        return this._types[type] ? this._types[type] : false;
    }

    getMetadata (mapConfig, layer, layerId, params, rendererCache, callback) {
        return callback(null, { cartocss: layer.options.cartocss });
    }
};
