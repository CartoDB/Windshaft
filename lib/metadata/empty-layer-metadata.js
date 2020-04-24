'use strict';

module.exports = class EmptyLayerMetadata {
    constructor (types) {
        this._types = types || {};
    }

    is (type) {
        return this._types[type] ? this._types[type] : false;
    }

    getMetadata (mapConfig, layer, layerId, params, rendererCache, callback) {
        process.nextTick(() => callback(null, {}));
    }
};
