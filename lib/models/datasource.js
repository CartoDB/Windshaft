'use strict';

/**
 * @param {Array} layersDbParams
 * @constructor
 */
function Datasource (layersDbParams) {
    layersDbParams = layersDbParams || [];
    if (!Array.isArray(layersDbParams)) {
        throw new Error('layersDbParams must be an Array');
    }
    this.layersDbParams = layersDbParams;
}

module.exports = Datasource;

Datasource.prototype.getLayerDatasource = function (layerIndex) {
    return this.layersDbParams[layerIndex] || {};
};

Datasource.prototype.obj = function () {
    return this.layersDbParams;
};

Datasource.prototype.isEmpty = function () {
    return this.layersDbParams.filter(function (layerDbParams) {
        return !!layerDbParams;
    }).length === 0;
};

Datasource.prototype.clone = function () {
    return new Datasource(this.layersDbParams.slice());
};

// ------------------ EmptyDatasource ------------------

function emptyDatasource () {
    return new Datasource([]);
}

module.exports.EmptyDatasource = emptyDatasource;

// ------------------ Builder ------------------

function Builder () {
    this.layersDbParams = [];
}

module.exports.Builder = Builder;

Builder.prototype.withLayerDatasource = function (layerIndex, dbParams) {
    this.layersDbParams[layerIndex] = dbParams;
    return this;
};

Builder.prototype.build = function () {
    return new Datasource(this.layersDbParams);
};
