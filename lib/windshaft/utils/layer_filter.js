'use strict';

module.exports = function filterLayer(mapConfig, mapLayers, layerFilter) {
    var filteredLayers = layerFilter.split(',');

    if (isFilterByLayerId(layerFilter)) {
        filteredLayers = filteredLayers.map(function (layerId) {
            return mapConfig.getIndexByLayerId(layerId);
        });
    } else {
        filteredLayers = filteredLayers.map(function(layerIdx) {
            return +layerIdx;
        });
    }

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

module.exports.isFilter = function isFilter(layerFilter) {
    if (typeof layerFilter !== 'string') {
        return false;
    }

    var filter = layerFilter.split(',');

    if (filter.length < 2) {
        // only one layer
        return false;
    }

    return filter.map(function (layerIdx) { return +layerIdx; })
        .every(Number.isFinite);
};

var isFilterByLayerId = module.exports.isFilterByLayerId = function (layerFilter) {
    if (typeof layerFilter !== 'string') {
        return false;
    }

    return layerFilter.split(',')
        .every(function (layerId) {
            return isNaN(layerId) && !isReservedKeyForLayer(layerId);
        });
};

function isReservedKeyForLayer(layerId) {
    var reservedKeys = {
        all: true,
        raster: true,
        mapnik: true,
        cartodb: true,
        torque: true,
        blend: true,
        http: true,
        plain: true
    };

    return !!reservedKeys[layerId];
}
