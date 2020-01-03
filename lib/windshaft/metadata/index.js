'use strict';

var LayerMetadata = require('./layer-metadata');
var EmptyLayerMetadata = require('./empty-layer-metadata');
var MapnikLayerMetadata = require('./mapnik-layer-metadata');
var TorqueLayerMetadata = require('./torque-layer-metadata');

module.exports = function LayerMetadataFactory () {
    var layerMetadataIterator = [];
    layerMetadataIterator.push(new EmptyLayerMetadata({ http: true, plain: true }));
    layerMetadataIterator.push(new MapnikLayerMetadata());
    layerMetadataIterator.push(new TorqueLayerMetadata());
    return new LayerMetadata(layerMetadataIterator);
};
