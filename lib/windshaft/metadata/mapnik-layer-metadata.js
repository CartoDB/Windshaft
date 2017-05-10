'use strict';

var PSQL = require('cartodb-psql');
var _ = require('underscore');
var assert = require('assert');
var step = require('step');
var RendererParams = require('../renderers/renderer_params');
var queryUtils = require('../utils/query_utils');

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
    return callback(null, {cartocss: layer.options.cartocss});
};

module.exports = MapnikLayerMetadata;
