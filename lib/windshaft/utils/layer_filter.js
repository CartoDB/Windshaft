'use strict';

const layerAliases = {
    mapnik: true,
    torque: true,
    http: true,
    plain: true
};

function defaultLayerFilter(layerFilter) {
    if (layerFilter === undefined) {
        return 'mapnik';
    }
    return layerFilter;
}

function resolveAlias(mapConfig, alias) {
    if (Number.isFinite(+alias)) {
        return [+alias];
    }
    if (alias === 'all') {
        return mapConfig.getLayers().map((_, i) => i);
    }
    if (!layerAliases.hasOwnProperty(alias)) {
        throw new Error('Invalid layer filtering');
    }
    return mapConfig.getLayers().reduce((filteredLayers, _, index) => {
        if (mapConfig.layerType(index) === alias) {
            filteredLayers.push(index);
        }
        return filteredLayers;
    }, []);
}


function resolveIds(mapConfig, layerIds) {
    const layerIdsToNumber = layerIds.map(_ => +_);
    if (layerIdsToNumber.every(Number.isFinite)) {
        return layerIdsToNumber;
    }
    if (layerIdsToNumber.every(Number.isNaN)) {
        return layerIds.map(mapConfig.getIndexByLayerId.bind(mapConfig));
    }

    throw new Error('Invalid layer filtering');
}

function checkLayerBounds(mapConfig, filteredLayers) {
    var uppermostLayerIdx = filteredLayers[filteredLayers.length - 1];
    var lowestLayerIdx = filteredLayers[0];

    if (lowestLayerIdx < 0 || uppermostLayerIdx >= mapConfig.getLayers().length) {
        throw new Error('Invalid layer filtering');
    }
}

module.exports = function filterLayer(mapConfig, layerFilter) {
    layerFilter = defaultLayerFilter(layerFilter);

    var filteredLayers = [];

    if (typeof layerFilter === 'string') {
        const layers = layerFilter.split(',');
        if (layers.length === 1) {
            filteredLayers = resolveAlias(mapConfig, layers[0]);
        } else {
            filteredLayers = resolveIds(mapConfig, layers);
        }
    } else if (!Array.isArray(layerFilter)) {
        filteredLayers = [ layerFilter ];
    } else {
        filteredLayers = layerFilter;
    }

    if (!filteredLayers.every(Number.isFinite)) {
        throw new Error('Invalid layer filtering');
    }

    filteredLayers = filteredLayers.sort(function(a, b) { return a - b; });

    checkLayerBounds(mapConfig, filteredLayers);

    return filteredLayers;
};

module.exports.isSingleLayer = function isSingleLayer(layerFilter) {
    return Number.isFinite(+layerFilter);
};
