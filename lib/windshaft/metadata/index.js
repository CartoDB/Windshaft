'use strict';

var LayerMetadata = require('./layer-metadata');
var EmptyLayerMetadata = require('./empty-layer-metadata');
var MapnikLayerMetadata = require('./mapnik-layer-metadata');
var TorqueLayerMetadata = require('./torque-layer-metadata');

module.exports = function LayerMetadataFactory() {
    var emptyLayerMetadata = new EmptyLayerMetadata();
    var mapnikLayerMetadata = new MapnikLayerMetadata();
    var torqueLayerMetadata = new TorqueLayerMetadata();

    var layerMetadataIterator = [
        emptyLayerMetadata,
        mapnikLayerMetadata,
        torqueLayerMetadata
    ];

    return new LayerMetadata(layerMetadataIterator);
};
