'use strict';

function LayerMetadata (layerMetadataIterator) {
    this.layerMetadataIterator = layerMetadataIterator;
}

LayerMetadata.prototype.getLayerMetadataFn = function (mapConfig, layerId) {
    const layerType = mapConfig.layerType(layerId);
    let getMetadadaFn;

    for (const layerMetadata of this.layerMetadataIterator) {
        if (layerMetadata.is(layerType)) {
            getMetadadaFn = layerMetadata.getMetadata.bind(layerMetadata);
            break;
        }
    }

    return getMetadadaFn;
};

LayerMetadata.prototype.getMetadata = function (rendererCache, params, mapConfig, callback) {
    const metadataParams = mapConfig.getLayers()
        .map((layer, layerId) => {
            const getMetadata = this.getLayerMetadataFn(mapConfig, layerId);
            return getMetadata ? { getMetadata, mapConfig, layer, layerId, params, rendererCache } : null;
        })
        .filter(metadataParam => metadataParam !== null);

    if (!metadataParams.length) {
        return callback(null, []);
    }

    return Promise.all(metadataParams.map(({ getMetadata, mapConfig, layer, layerId, params, rendererCache }) => {
        return new Promise((resolve, reject) => {
            getMetadata(mapConfig, layer, layerId, params, rendererCache, (err, metadata) => {
                if (err) {
                    return reject(err);
                }

                return resolve(metadata);
            });
        });
    }))
        .then(results => {
            if (!results.length) {
                return callback(null, null);
            }

            const metadata = [];

            mapConfig.getLayers().forEach(function (layer, layerIndex) {
                var layerType = mapConfig.layerType(layerIndex);

                metadata[layerIndex] = {
                    type: layerType,
                    id: mapConfig.getLayerId(layerIndex),
                    meta: results[layerIndex]
                };

                if (layer.options.cartocss && metadata[layerIndex].meta) {
                    metadata[layerIndex].meta.cartocss = layer.options.cartocss;
                }
            });

            return callback(null, metadata);
        })
        .catch(err => callback(err));
};

module.exports = LayerMetadata;
