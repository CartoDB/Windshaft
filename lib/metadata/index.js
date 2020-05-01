'use strict';

const LayerMetadata = require('./layer-metadata');
const EmptyLayerMetadata = require('./empty-layer-metadata');
const MapnikLayerMetadata = require('./mapnik-layer-metadata');
const TorqueLayerMetadata = require('./torque-layer-metadata');

module.exports = function layerMetadataFactory () {
    const layerMetadataIterator = [];

    layerMetadataIterator.push(new EmptyLayerMetadata({ http: true, plain: true }));
    layerMetadataIterator.push(new MapnikLayerMetadata());
    layerMetadataIterator.push(new TorqueLayerMetadata());

    return new LayerMetadata(layerMetadataIterator);
};
