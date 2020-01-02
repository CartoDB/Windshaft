'use strict';

var DummyMapConfigProvider = require('../models/providers/dummy_mapconfig_provider');

function TorqueLayerMetadata () {
    this._types = {
        torque: true
    };
}

TorqueLayerMetadata.prototype.is = function (type) {
    return this._types[type] ? this._types[type] : false;
};

TorqueLayerMetadata.prototype.getMetadata = function (mapConfig, layer, layerId, params, rendererCache, callback) {
    params = Object.assign({}, params, {
        token: mapConfig.id(),
        format: 'json.torque',
        layer: layerId
    });

    const dummyMapConfigProvider = new DummyMapConfigProvider(mapConfig, params);
    rendererCache.getRenderer(dummyMapConfigProvider, function (err, renderer) {
        if (err) {
            if (renderer) {
                renderer.release();
            }

            return callback(err);
        }

        renderer.getMetadata(function (err, meta) {
            if (renderer) {
                renderer.release();
            }

            if (err) {
                return callback(err);
            }

            return callback(null, meta);
        });
    });
};

module.exports = TorqueLayerMetadata;
