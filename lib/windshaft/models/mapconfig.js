var Crypto = require('crypto');
var semver = require('semver');
var LayerColumns = require('../utils/layer-columns');

var Datasource = require('./datasource');

// Map configuration object

/// API: Create MapConfig from configuration object
//
/// @param obj js MapConfiguration object, see
///        http://github.com/CartoDB/Windshaft/wiki/MapConfig-specification
///
function MapConfig(config, datasource) {
    // TODO: inject defaults ?
    this._cfg = config;

    if ( ! semver.satisfies(this.version(), '>= 1.0.0 <= 1.6.0') ) {
        throw new Error("Unsupported layergroup configuration version " + this.version());
    }

    if ( ! this._cfg.hasOwnProperty('layers') ) {
        throw new Error("Missing layers array from layergroup config");
    }

    this._cfg.layers.forEach(function(layer, i) {
    if ( ! layer.hasOwnProperty('options') ) {
        throw new Error("Missing options from layer " + i + " of layergroup config");
    }
    // NOTE: interactivity used to be a string as of version 1.0.0
    if ( Array.isArray(layer.options.interactivity) ) {
        layer.options.interactivity = layer.options.interactivity.join(',');
    }
  });

    /**
    * @type {Datasource}
    */
    this._datasource = datasource;

    this._id = null;
}

function md5Hash(s) {
    return Crypto.createHash('md5').update(s, 'binary').digest('hex');
}

/// API: Get serialized version of this MapConfig
MapConfig.prototype.serialize = function() {
    if (this._datasource.isEmpty()) {
        return JSON.stringify(this._cfg);
    }
    return JSON.stringify({
        cfg: this._cfg,
        ds: this._datasource.obj()
    });
};

/// API: Get identifier for this MapConfig
MapConfig.prototype.id = function() {
    if (this._id === null) {
        this._id = md5Hash(JSON.stringify(this._cfg));
    }
    //debug('MapConfig.id=%s', this._id);
    return this._id;
};

/// API: Get configuration object of this MapConfig
MapConfig.prototype.obj = function() {
    return this._cfg;
};

MapConfig.prototype.version = function() {
    return this._cfg.version || '1.0.0';
};

MapConfig.prototype.setDbParams = function(dbParams) {
    this._cfg.dbparams = dbParams;
    this.flush();
};

MapConfig.prototype.flush = function() {
    // flush id so it gets recalculated
    this._id = null;
};

/// API: Get type string of given layer
//
/// @param num layer index (0-based)
/// @returns a type string, as read from the layer
///
MapConfig.prototype.layerType = function(num) {
    var lyr = this.getLayer(num);
    if ( ! lyr ) {
        return undefined;
    }
    return this.getType(lyr.type);
};

MapConfig.prototype.getType = function(type) {
    return getType(type);
};

function getType(type) {
    // TODO: check validity of other types ?
    return (!type || type === 'cartodb') ? 'mapnik' : type;
}

MapConfig.prototype.setBufferSize = function (bufferSize) {
    this._cfg.bufferSize = bufferSize;
    this.flush();
    return this;
};

MapConfig.prototype.getBufferSize = function (format) {
    if (this._cfg.buffersize && isValidBufferSize(this._cfg.buffersize[format])) {
        return parseInt(this._cfg.buffersize[format], 10);
    }

    return undefined;
};

function isValidBufferSize(value) {
    return Number.isFinite(parseInt(value, 10));
}

/*****************************************************************************
 * Vector MapConfig
 ****************************************************************************/

MapConfig.prototype.hasIncompatibleLayers = function () {
    return !this.isVectorOnlyMapConfig() && this.hasVectorLayer();
};

MapConfig.prototype.isVectorOnlyMapConfig = function () {
    const layers = this.getLayers();
    let isVectorOnlyMapConfig = false;

    if (!layers.length) {
        return isVectorOnlyMapConfig;
    }

    isVectorOnlyMapConfig = true;

    for (let index = 0; index < layers.length; index++) {
        if (!this.isVectorLayer(index)) {
            isVectorOnlyMapConfig = false;
            break;
        }
    }

    return isVectorOnlyMapConfig;
};

MapConfig.prototype.hasVectorLayer = function () {
    const layers = this.getLayers();
    let hasVectorLayer = false;

    for (let index = 0; index < layers.length; index++) {
        if (this.isVectorLayer(index)) {
            hasVectorLayer = true;
            break;
        }
    }

    return hasVectorLayer;
};

MapConfig.prototype.isVectorLayer = function (index) {
    const layer = this.getLayer(index);
    const type =  getType(layer.type);
    const sql = this.getLayerOption(index, 'sql');
    const cartocss = this.getLayerOption(index, 'cartocss');
    const cartocssVersion = this.getLayerOption(index, 'cartocss_version');

    return type === 'mapnik' && typeof sql === 'string' && cartocss === undefined && cartocssVersion === undefined;
};

/*****************************************************************************
 * Aggregation
 ****************************************************************************/

MapConfig.prototype.isAggregationMapConfig = function () {
    return this.isVectorOnlyMapConfig() || this.hasAnyLayerAggregation();
};

MapConfig.prototype.isAggregationLayer = function (index) {
    return this.isVectorOnlyMapConfig() || this.hasLayerAggregation(index);
};

MapConfig.prototype.hasAnyLayerAggregation = function () {
    const layers = this.getLayers();

    for (let index = 0; index < layers.length; index++) {
        if (this.hasLayerAggregation(index)) {
            return true;
        }
    }

    return false;
};

MapConfig.prototype.hasLayerAggregation = function (index) {
    const layer = this.getLayer(index);
    const { aggregation } = layer.options;

    return aggregation !== undefined && (typeof aggregation === 'object' || typeof aggregation === 'boolean');
};

const MISSING_AGGREGATION_COLUMNS = 'Missing columns in the aggregation. The map-config defines cartocss expressions,'+
' interactivity fields or attributes that are not present in the aggregation';

MapConfig.prototype.validateAggregation = function () {
    if (this._hasAggregationMissingColumns()) {
        throw new Error(MISSING_AGGREGATION_COLUMNS);
    }
};

MapConfig.prototype._hasAggregationMissingColumns = function () {
    const layers = this.getLayers();

    if (!this.isAggregationMapConfig()) {
        return false;
    }

    for (let index = 0; index < layers.length; index++) {
        const aggregationColumns = this._getAggregationColumnsByLayer(index);
        const layerColumns = this.getColumnsByLayer(index);

        if (layerColumns.length === 0) {
            continue;
        }

        if (aggregationColumns.length === 0) {
            return true;
        }

        if (aggregationColumns.length !== layerColumns.length) {
            return true;
        }

        const missingColumns = aggregationColumns.filter(column => !layerColumns.includes(column));

        if (missingColumns.length > 0) {
            return true;
        }
    }

    return false;
};

MapConfig.prototype._getAggregationColumnsByLayer = function (index) {
    const { aggregation } = this.getLayer(index).options;
    const hasAggregationColumns = aggregation !== undefined &&
        typeof aggregation !== 'boolean' &&
        typeof aggregation.columns === 'object';

    return hasAggregationColumns ? Object.keys(aggregation.columns) : [];
}

/*****************************************************************************
 * Layers
 ****************************************************************************/

MapConfig.prototype.getLayerId = function(layerIndex) {
    return getLayerId(this._cfg, layerIndex);
};

function getLayerId(rawMapConfig, layerIndex) {
    var layer = rawMapConfig.layers[layerIndex];
    if (layer.id) {
        return layer.id;
    }

    var layerType = getType(layer.type);
    var layerId = 'layer' + getLayerIndexByType(rawMapConfig, layerType, layerIndex);
    if (layerType !== 'mapnik') {
        layerId = layerType + '-' + layerId;
    }
    return layerId;
}

MapConfig.prototype.getIndexByLayerId = function (layerId) {
    var layers = this.getLayers();

    for (var i = 0; i < layers.length; i++) {
        if (layers[i].id === layerId) {
            return i;
        }
    }

    return -1;
};

/// API: Get layer by index
//
/// @returns undefined on invalid index
///
MapConfig.prototype.getLayer = function(layerIndex) {
    return this._cfg.layers[layerIndex];
};

MapConfig.prototype.getLayers = function() {
    return this._cfg.layers.map(function(_layer, layerIndex) {
        return this.getLayer(layerIndex);
    }.bind(this));
};

MapConfig.prototype.getLayerIndexByType = function(type, mapConfigLayerIdx) {
    return getLayerIndexByType(this._cfg, type, mapConfigLayerIdx);
};

function getLayerIndexByType(rawMapConfig, type, mapConfigLayerIdx) {
    var typeLayerIndex = 0;
    var mapConfigToTypeLayers = {};

    rawMapConfig.layers.forEach(function (layer, layerIdx) {
        if (getType(layer.type) === type) {
            mapConfigToTypeLayers[layerIdx] = typeLayerIndex++;
        }
    });

    return mapConfigToTypeLayers[mapConfigLayerIdx];
}

MapConfig.prototype.getLayerOption = function(layerIndex, optionName, defaultValue) {
    var layerOption = defaultValue;
    var layer = this.getLayer(layerIndex);
    if (layer && layer.options.hasOwnProperty(optionName)) {
        layerOption = layer.options[optionName];
    }
    return layerOption;
};

/*****************************************************************************
 * Columns
 ****************************************************************************/

MapConfig.prototype.getColumns = function () {
    return this.getLayers().map(layer => {
        return LayerColumns.getColumns(layer.options);
    });
};

MapConfig.prototype.getColumnsByLayer = function (index) {
    const layer = this.getLayer(index);
    return LayerColumns.getColumns(layer.options);
};

/*****************************************************************************
 * Datasource
 ****************************************************************************/

MapConfig.prototype.getLayerDatasource = function (layerIndex) {
    var datasource = this._datasource.getLayerDatasource(layerIndex) || {};

    var layerSrid = this.getLayerOption(layerIndex, 'srid');
    if (layerSrid) {
        datasource.srid = layerSrid;
    }

    return datasource;
};

/**
 * À la Factory method
 *
 * @param {Object} rawConfig
 * @param {Datasource} [datasource=Datasource.EmptyDatasource()]
 * @returns {MapConfig}
 */
function create(rawConfig, datasource) {
    if (rawConfig.ds) {
        return new MapConfig(rawConfig.cfg, new Datasource(rawConfig.ds));
    }
    datasource = datasource || Datasource.EmptyDatasource();
    return new MapConfig(rawConfig, datasource);
}



module.exports = MapConfig;
// Factory like method to create MapConfig objects when you are unsure about being
// able to provide all the MapConfig collaborators or you have to create a MapConfig
// object from a serialized version
module.exports.create = create;

module.exports.getLayerId = getLayerId;
