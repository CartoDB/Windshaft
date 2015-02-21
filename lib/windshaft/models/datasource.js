/**
 * @param {Array} layersDbParams
 * @constructor
 */
function Datasource(layersDbParams) {
    layersDbParams = layersDbParams || [];
    if (!Array.isArray(layersDbParams)) {
        throw new Error('layersDbParams must be an Array');
    }
    this.layersDbParams = layersDbParams;
}

module.exports = Datasource;


Datasource.prototype.getLayerDatasource = function(layerId) {
    return this.layersDbParams[layerId];
};

Datasource.prototype.obj = function() {
    return this.layersDbParams;
};

Datasource.prototype.isEmpty = function() {
    return this.layersDbParams.filter(function(layerDbParams) {
        return !!layerDbParams;
    }).length === 0;
};

// ------------------ EmptyDatasource ------------------

function emptyDatasource() {
    return new Datasource([]);
}

module.exports.EmptyDatasource = emptyDatasource;



// ------------------ Builder ------------------

function Builder() {
    this.layersDbParams = [];
};

module.exports.Builder = Builder;


Builder.prototype.withLayerDatasource = function(layerId, dbParams) {
    this.layersDbParams[layerId] = dbParams;
    return this;
};

Builder.prototype.build = function() {
    return new Datasource(this.layersDbParams);
};
