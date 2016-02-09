'use strict';

module.exports = function filterLayer(mapConfig, mapLayers, layerFilter) {
    var filteredLayers = layerFilter.split(',').map(function(layerIdx) {
        return +layerIdx;
    });

    if (!filteredLayers.every(Number.isFinite)) {
        throw new Error('Invalid layer filtering');
    }

    filteredLayers = filteredLayers.sort(function(a, b) { return a - b; });

    var uppermostLayerIdx = filteredLayers[filteredLayers.length - 1];
    var lowestLayerIdx = filteredLayers[0];

    if (lowestLayerIdx < 0 || uppermostLayerIdx >= mapLayers.length) {
        throw new Error('Invalid layer filtering');
    }

    return filteredLayers;
};
