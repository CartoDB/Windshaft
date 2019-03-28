'use strict';

var queue = require('queue-async');

function LayerMetadata(layerMetadataIterator) {
    this.layerMetadataIterator = layerMetadataIterator;
}

LayerMetadata.prototype.getMetadata = function (rendererCache, params, mapConfig, callback) {
    var self = this;
    var metadata = [];

    var metaQueue = queue(mapConfig.getLayers().length);

    mapConfig.getLayers().forEach(function(layer, layerId) {
        var layerType = mapConfig.layerType(layerId);

        for (var i = 0; i < self.layerMetadataIterator.length; i++) {
            if (self.layerMetadataIterator[i].is(layerType)) {
                var getMetadata = self.layerMetadataIterator[i].getMetadata.bind(self.layerMetadataIterator[i]);
                metaQueue.defer(getMetadata, mapConfig, layer, layerId, params, rendererCache);
                break;
            }
        }
    });

    metaQueue.awaitAll(function (err, results) {
        if (err) {
            return callback(err);
        }

        if (!results) {
            return callback(null, null);
        }

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

        return callback(err, metadata);
    });

};

module.exports = LayerMetadata;
