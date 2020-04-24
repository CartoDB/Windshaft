'use strict';

const DummyMapConfigProvider = require('../models/providers/dummy-mapconfig-provider');

module.exports = class TorqueLayerMetadata {
    constructor () {
        this._types = {
            torque: true
        };
    }

    is (type) {
        return this._types[type] ? this._types[type] : false;
    }

    getMetadata (mapConfig, layer, layerId, params, rendererCache, callback) {
        params = Object.assign({}, params, {
            token: mapConfig.id(),
            format: 'json.torque',
            layer: layerId
        });

        const dummyMapConfigProvider = new DummyMapConfigProvider(mapConfig, params);

        rendererCache.getRenderer(dummyMapConfigProvider, (err, renderer) => {
            if (err) {
                if (renderer) {
                    renderer.release();
                }

                return callback(err);
            }

            renderer.getMetadata()
                .then(meta => callback(null, meta))
                .catch(err => callback(err))
                .finally(() => renderer ? renderer.release() : undefined);
        });
    }
};
