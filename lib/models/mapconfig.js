'use strict';

const crypto = require('crypto');
const semver = require('semver');
const Datasource = require('./datasource');

// see: http://github.com/CartoDB/Windshaft/wiki/MapConfig-specification
module.exports = class MapConfig {
    // Factory like method to create MapConfig objects when you are unsure about being
    // able to provide all the MapConfig collaborators or you have to create a MapConfig
    // object from a serialized version
    static create (rawConfig, datasource) {
        if (rawConfig.ds) {
            return new MapConfig(rawConfig.cfg, new Datasource(rawConfig.ds));
        }
        datasource = datasource || Datasource.EmptyDatasource();
        return new MapConfig(rawConfig, datasource);
    }

    static getLayerId (rawMapConfig, layerIndex) {
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

    constructor (config, datasource) {
        // TODO: inject defaults ?
        this._cfg = config;

        if (!semver.satisfies(this.version(), '>= 1.0.0 <= 1.8.0')) {
            throw new Error('Unsupported layergroup configuration version ' + this.version());
        }

        if (!Object.prototype.hasOwnProperty.call(this._cfg, 'layers')) {
            throw new Error('Missing layers array from layergroup config');
        }

        this._cfg.layers.forEach(function (layer, i) {
            if (!Object.prototype.hasOwnProperty.call(layer, 'options')) {
                throw new Error('Missing options from layer ' + i + ' of layergroup config');
            }
            // NOTE: interactivity used to be a string as of version 1.0.0
            if (Array.isArray(layer.options.interactivity)) {
                layer.options.interactivity = layer.options.interactivity.join(',');
            }
        });

        if (this._cfg.buffersize) {
            Object.keys(this._cfg.buffersize).forEach(format => {
                if (this._cfg.buffersize[format] !== undefined && !Number.isFinite(this._cfg.buffersize[format])) {
                    throw new Error(`Buffer size of format "${format}" must be a number`);
                }
            });
        }

        /**
        * @type {Datasource}
        */
        this._datasource = datasource;

        this._id = null;
    }

    serialize () {
        if (this._datasource.isEmpty()) {
            return JSON.stringify(this._cfg);
        }
        return JSON.stringify({
            cfg: this._cfg,
            ds: this._datasource.obj()
        });
    }

    id () {
        if (this._id === null) {
            this._id = md5Hash(JSON.stringify(this._cfg));
        }

        return this._id;
    }

    obj () {
        return this._cfg;
    }

    version () {
        return this._cfg.version || '1.0.0';
    }

    setDbParams (dbParams) {
        this._cfg.dbparams = dbParams;
        this.flush();
    }

    // flush id so it gets recalculated
    flush () {
        this._id = null;
    }

    layerType (layerIndex) {
        var lyr = this.getLayer(layerIndex);
        if (!lyr) {
            return undefined;
        }
        return this.getType(lyr.type);
    }

    getType (type) {
        return getType(type);
    }

    setBufferSize (bufferSize) {
        this._cfg.buffersize = bufferSize;
        this.flush();

        return this;
    }

    getBufferSize (format) {
        if (this._cfg.buffersize && isValidBufferSize(this._cfg.buffersize[format])) {
            return parseInt(this._cfg.buffersize[format], 10);
        }

        return undefined;
    }

    hasIncompatibleLayers () {
        return !this.isVectorOnlyMapConfig() && this.hasVectorLayer();
    }

    isVectorOnlyMapConfig () {
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
    }

    hasVectorLayer () {
        const layers = this.getLayers();
        let hasVectorLayer = false;

        for (let index = 0; index < layers.length; index++) {
            if (this.isVectorLayer(index)) {
                hasVectorLayer = true;
                break;
            }
        }

        return hasVectorLayer;
    }

    isVectorLayer (index) {
        const layer = this.getLayer(index);
        const type = getType(layer.type);
        const sql = this.getLayerOption(index, 'sql');
        const cartocss = this.getLayerOption(index, 'cartocss');
        const cartocssVersion = this.getLayerOption(index, 'cartocss_version');

        return type === 'mapnik' && typeof sql === 'string' && cartocss === undefined && cartocssVersion === undefined;
    }

    /*****************************************************************************
     * Layers
     ****************************************************************************/

    getLayerId (layerIndex) {
        return MapConfig.getLayerId(this._cfg, layerIndex);
    }

    getIndexByLayerId (layerId) {
        var layers = this.getLayers();

        for (var i = 0; i < layers.length; i++) {
            if (layers[i].id === layerId) {
                return i;
            }
        }

        return -1;
    }

    getLayer (layerIndex) {
        return this._cfg.layers[layerIndex];
    }

    getLayers () {
        return this._cfg.layers.map(function (_layer, layerIndex) {
            return this.getLayer(layerIndex);
        }.bind(this));
    }

    getLayerIndexByType (type, mapConfigLayerIdx) {
        return getLayerIndexByType(this._cfg, type, mapConfigLayerIdx);
    }

    getLayerOption (layerIndex, optionName, defaultValue) {
        var layerOption = defaultValue;
        var layer = this.getLayer(layerIndex);
        if (layer && Object.prototype.hasOwnProperty.call(layer.options, optionName)) {
            layerOption = layer.options[optionName];
        }
        return layerOption;
    }

    /*****************************************************************************
     * Datasource
     ****************************************************************************/

    getLayerDatasource (layerIndex) {
        var datasource = this._datasource.getLayerDatasource(layerIndex) || {};

        var layerSrid = this.getLayerOption(layerIndex, 'srid');
        if (layerSrid) {
            datasource.srid = layerSrid;
        }

        return datasource;
    }

    /*****************************************************************************
     * MVT
     ****************************************************************************/

    getMVTExtents () {
        const layers = this.getLayers();
        const extent = getTileExtent(layers);
        const simplifyExtent = getSimplifyExtent(layers, extent);

        return { extent: extent || DEFAULT_EXTENT, simplify_extent: simplifyExtent || DEFAULT_SIMPLIFY_EXTENT };
    }
};

function md5Hash (s) {
    return crypto.createHash('md5').update(s, 'binary').digest('hex');
}

function getType (type) {
    // TODO: check validity of other types ?
    return (!type || type === 'cartodb') ? 'mapnik' : type;
}

function isValidBufferSize (value) {
    return Number.isFinite(parseInt(value, 10));
}

/*****************************************************************************
 * Layers
 ****************************************************************************/

function getLayerIndexByType (rawMapConfig, type, mapConfigLayerIdx) {
    var typeLayerIndex = 0;
    var mapConfigToTypeLayers = {};

    rawMapConfig.layers.forEach(function (layer, layerIdx) {
        if (getType(layer.type) === type) {
            mapConfigToTypeLayers[layerIdx] = typeLayerIndex++;
        }
    });

    return mapConfigToTypeLayers[mapConfigLayerIdx];
}

/*****************************************************************************
 * MVT
 ****************************************************************************/

const DEFAULT_EXTENT = 4096;
const DEFAULT_SIMPLIFY_EXTENT = 256;
// Accepted values between 1 and 2^31 -1 (DEFAULT_MAX_EXTENT)
const DEFAULT_MAX_EXTENT = 2147483647;
const DEFAULT_MIN_EXTENT = 1;

function checkRange (number, min, max) {
    return (!isNaN(number) && number >= min && number <= max);
}

// Checks all layers for a valid `vector_simplify_extent`
// Makes sure all layers have the same value (or using DEFAULT_EXTENT)
// Returns undefined if none of the layers have it declared
function getSimplifyExtent (layers, vectorExtent) {
    let undef = 0;
    const extents = [...new Set(layers.map(layer => {
        if (layer.options.vector_simplify_extent === undefined) {
            undef++;
            return layer.options.vector_extent || DEFAULT_SIMPLIFY_EXTENT;
        }
        return layer.options.vector_simplify_extent;
    }))];

    if (extents.length > 1) {
        throw new Error('Multiple simplify extent values in mapConfig (' + extents + ')');
    }

    if (undef === layers.length) {
        return vectorExtent;
    }

    const maxExtent = vectorExtent || DEFAULT_EXTENT;

    // Accepted values between 1 and max_extent
    const simplifyExtent = parseInt(extents[0]);
    if (!checkRange(simplifyExtent, DEFAULT_MIN_EXTENT, maxExtent)) {
        throw new Error('Invalid vector_simplify_extent (' + simplifyExtent + '). ' +
                        'Must be between 1 and vector_extent [' + maxExtent + ']');
    }

    return simplifyExtent;
}

// Checks all layers for a valid `vectorExtent`
// Makes sure all layers have the same value (or using DEFAULT_EXTENT)
// Returns undefined if none of the layers have it declared
function getTileExtent (layers) {
    let undef = 0;
    const layerExtents = [...new Set(layers.map(layer => {
        if (layer.options.vector_extent === undefined) {
            undef++;
            return DEFAULT_EXTENT;
        }
        return layer.options.vector_extent;
    }))];

    if (layerExtents.length > 1) {
        throw new Error('Multiple extent values in mapConfig (' + layerExtents + ')');
    }

    if (undef === layers.length) {
        return undefined;
    }

    const extent = parseInt(layerExtents[0]);
    if (!checkRange(extent, DEFAULT_MIN_EXTENT, DEFAULT_MAX_EXTENT)) {
        throw new Error('Invalid vector_extent. Must be between 1 and ' + DEFAULT_MAX_EXTENT);
    }

    return extent;
}
