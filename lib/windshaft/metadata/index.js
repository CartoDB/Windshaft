'use strict';

var LayerMetadata = require('./layer-metadata');
var EmptyLayerMetadata = require('./empty-layer-metadata');
var MapnikLayerMetadata = require('./mapnik-layer-metadata');
var TorqueLayerMetadata = require('./torque-layer-metadata');

module.exports = function LayerMetadataFactory() {
    var layerMetadataIterator = [];

    // INFO: temporary feature to enable/disable layer metadata stats
    var enabledFeatures = global.environment.enabledFeatures;
    var layerMetadataEnabled = enabledFeatures ? enabledFeatures.layerMetadata : false;

    if (layerMetadataEnabled) {
        layerMetadataIterator.push(new EmptyLayerMetadata({ http: true, plain: true }));
        layerMetadataIterator.push(new MapnikLayerMetadata());
    } else {
        layerMetadataIterator.push(new EmptyLayerMetadata({ http: true, plain: true, mapnik: true}));
    }

    layerMetadataIterator.push(new TorqueLayerMetadata());

    return new LayerMetadata(layerMetadataIterator);
};
