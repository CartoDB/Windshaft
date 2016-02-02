'use strict';

var LayerMetadata = require('./layer-metadata');
var EmptyLayerMetadata = require('./empty-layer-metadata');
var MapnikLayerMetadata = require('./mapnik-layer-metadata');
var TorqueLayerMetadata = require('./torque-layer-metadata');

module.exports = function LayerMetadataFactory() {
    var layerMetadataIterator = [];
    var layerMetadataEnabled = global.environment.enabledFeatures.layerMetadata;

    if (layerMetadataEnabled) {
        layerMetadataIterator.push(new EmptyLayerMetadata(['http']));
        layerMetadataIterator.push(new MapnikLayerMetadata());
        layerMetadataIterator.push(new TorqueLayerMetadata());
    } else {
        layerMetadataIterator.push(new EmptyLayerMetadata(['http', 'mapnik', 'torque']));
    }

    return new LayerMetadata(layerMetadataIterator);
};
