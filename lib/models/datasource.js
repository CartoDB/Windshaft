'use strict';

class Datasource {
    constructor (layersDbParams = []) {
        if (!Array.isArray(layersDbParams)) {
            throw new Error('layersDbParams must be an Array');
        }

        this.layersDbParams = layersDbParams;
    }

    getLayerDatasource (layerIndex) {
        return this.layersDbParams[layerIndex] || {};
    }

    obj () {
        return this.layersDbParams;
    }

    isEmpty () {
        return this.layersDbParams.filter(layerDbParams => !!layerDbParams).length === 0;
    }

    clone () {
        return new Datasource(this.layersDbParams.slice());
    }
}

class Builder {
    constructor () {
        this.layersDbParams = [];
    }

    withLayerDatasource (layerIndex, dbParams) {
        this.layersDbParams[layerIndex] = dbParams;
        return this;
    }

    build () {
        return new Datasource(this.layersDbParams);
    }
}

function emptyDatasource () {
    return new Datasource([]);
}

module.exports = Datasource;
module.exports.Builder = Builder;
module.exports.EmptyDatasource = emptyDatasource;
