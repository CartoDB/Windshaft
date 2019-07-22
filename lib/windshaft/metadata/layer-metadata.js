'use strict';

function LayerMetadata(layerMetadataIterator) {
    this.layerMetadataIterator = layerMetadataIterator;
}

LayerMetadata.prototype.getMetadata = function (rendererCache, params, mapConfig, callback) {
    const metadataParams = mapConfig.getLayers()
        .map((layer, layerId) => {
            const layerType = mapConfig.layerType(layerId);

            for (var i = 0; i < this.layerMetadataIterator.length; i++) {
                if (this.layerMetadataIterator[i].is(layerType)) {
                    const getMetadata = this.layerMetadataIterator[i].getMetadata.bind(this.layerMetadataIterator[i]);
                    return [ getMetadata, mapConfig, layer, layerId, params, rendererCache ];
                }
            }

            return null;
        })
        .filter(metadataParam => metadataParam !== null);

    if (!metadataParams.length) {
        return callback(null, null);
    }

    return Promise.all(metadataParams.map(([ getMetadata, mapConfig, layer, layerId, params, rendererCache ]) => {
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
        if (!Array.isArray(results) || !results.length) {
            return callback(null, null);
        }

        const metadata = [];

        mapConfig.getLayers().forEach(function(layer, layerIndex) {
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
