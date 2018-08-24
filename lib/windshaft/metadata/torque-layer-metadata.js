'use strict';

var assert = require('assert');
var _ = require('underscore');
var DummyMapConfigProvider = require('../models/providers/dummy_mapconfig_provider');

function TorqueLayerMetadata() {
    this._types = {
        torque: true
    };
}

TorqueLayerMetadata.prototype.is = function (type) {
    return this._types[type] ? this._types[type] : false;
};

TorqueLayerMetadata.prototype.getMetadata = function (mapConfig, layer, layerId, params, rendererCache, callback) {
    params = _.extend({}, params, {
        token: mapConfig.id(),
        format: 'json.torque',
        layer: layerId
    });

    rendererCache.getRenderer(new DummyMapConfigProvider(mapConfig, params), function (err, renderer) {
        assert.ifError(err);
        renderer.getMetadata(function(err, meta) {
            if ( renderer ) {
                renderer.release();
            }

            callback(err, meta);
        });
    });
};

module.exports = TorqueLayerMetadata;
