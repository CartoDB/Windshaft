'use strict';

const INCOMPATIBLE_LAYERS_ERROR = 'The `mapnik` or `cartodb` layers must be consistent:' +
    ' `cartocss` option is either present or voided in all layers. Mixing is not allowed.';

const MapConfigProviderProxy = require('../models/providers/mapconfig-provider-proxy');

/**
 * @param {TileBackend} tileBackend
 * @param {AttributesBackend} attributesBackend
 * @constructor
 * @type {MapValidatorBackend}
 */
function MapValidatorBackend (tileBackend, attributesBackend) {
    this.tileBackend = tileBackend;
    this.attributesBackend = attributesBackend;
}

module.exports = MapValidatorBackend;

MapValidatorBackend.prototype.validate = function (mapConfigProvider, callback) {
    mapConfigProvider.getMapConfig((err, mapConfig, params) => {
        if (err) {
            return callback(err, false);
        }

        var token = mapConfig.id();

        if (mapConfig.isVectorOnlyMapConfig()) {
            return this.validateVectorLayergroup(mapConfigProvider, params, token)
                .then(() => callback(null, true))
                .catch(err => callback(err, false));
        }

        if (mapConfig.hasIncompatibleLayers()) {
            const error = new Error(INCOMPATIBLE_LAYERS_ERROR);
            error.type = 'mapconfig';
            error.http_status = 400;
            return callback(error);
        }

        var mapnikLayersIds = getMapnikLayerIds(mapConfig);

        if (!mapnikLayersIds.length) {
            return this._validateRemaningFormatLayers(mapConfigProvider, mapConfig, params)
                .then(() => callback(null, true))
                .catch(err => callback(err, false));
        }

        let allLayers; // if layer is undefined then it fetchs all layers
        this.tryFetchTileOrGrid(mapConfigProvider, params, token, 'png', allLayers)
            .then(() => this._validateRemaningFormatLayers(mapConfigProvider, mapConfig, params))
            .then(() => callback(null, true))
            .catch(errAllLayers => {
                const checkFailingMapnikTileLayerFns = mapnikLayersIds.map(layerId =>
                    this.tryFetchTileOrGrid(mapConfigProvider, params, token, 'png', layerId)
                );

                if (!checkFailingMapnikTileLayerFns.length) {
                    return callback(errAllLayers, !errAllLayers);
                }

                return Promise.all(checkFailingMapnikTileLayerFns)
                    .then(() => callback(errAllLayers, false))
                    .catch(err => callback(err, false));
            });
    });
};

MapValidatorBackend.prototype._validateRemaningFormatLayers = function (mapConfigProvider, mapConfig, params) {
    const token = mapConfig.id();
    const validateRemainingFormatLayerPromises = [];

    mapConfig.getLayers().forEach((layer, layerId) => {
        var lyropt = layer.options;
        var layerType = mapConfig.layerType(layerId);

        if (layerType === 'mapnik') {
            if (lyropt.interactivity) {
                validateRemainingFormatLayerPromises.push(
                    this.tryFetchTileOrGrid(mapConfigProvider, params, token, 'grid.json', layerId)
                );
            }
        } else if (layerType === 'torque') {
            validateRemainingFormatLayerPromises.push(
                this.tryFetchTileOrGrid(mapConfigProvider, params, token, 'json.torque', layerId)
            );
        }

        // both 'cartodb' or 'torque' types can have attributes
        // attribute validation is usually very inefficient when sql_raw if present so we skip it
        if (lyropt.attributes && !lyropt.sql_raw) {
            validateRemainingFormatLayerPromises.push(
                this.tryFetchFeatureAttributes(mapConfigProvider, params, token, layerId)
            );
        }
    });

    if (!validateRemainingFormatLayerPromises.length) {
        return Promise.resolve();
    }

    return Promise.all(validateRemainingFormatLayerPromises);
};

function getMapnikLayerIds (mapConfig) {
    var mapnikLayerIds = [];

    mapConfig.getLayers().forEach(function (layer, layerId) {
        if (mapConfig.layerType(layerId) === 'mapnik') {
            mapnikLayerIds.push(layerId);
        }
    });

    return mapnikLayerIds;
}

MapValidatorBackend.prototype.tryFetchTileOrGrid = function (mapConfigProvider, _params, token, format, layerId) {
    const params = Object.assign({}, _params);
    params.token = token;
    params.format = format;
    params.layer = layerId;
    params.x = 0;
    params.y = 0;
    params.z = 30;

    return new Promise((resolve, reject) => {
        this.tileBackend.getTile(new MapConfigProviderProxy(mapConfigProvider, params), params, function (err) {
            if (err) {
                // Grainstore returns styles error indicating layer index, since validation is performed
                // one by one instead of all blended layers of MapConfig, this fixes the error message to
                // show the right layer index.
                if (err.message.match(/^style0: CartoCSS is empty/) && layerId > 0) {
                    err.message = err.message.replace(/style0/i, 'style' + layerId);
                }
                err.layerIndex = layerId;

                return reject(err);
            }
            return resolve();
        });
    });
};

MapValidatorBackend.prototype.tryFetchFeatureAttributes = function (mapConfigProvider, _params, token, layernum) {
    const params = Object.assign({}, _params);
    params.token = token;
    params.layer = layernum;

    const proxyProvider = new MapConfigProviderProxy(mapConfigProvider, params);

    return new Promise((resolve, reject) => {
        this.attributesBackend.getFeatureAttributes(proxyProvider, params, true, err => {
            if (err) {
                err.layerIndex = layernum;
                return reject(err);
            }
            resolve();
        });
    });
};

MapValidatorBackend.prototype.validateVectorLayergroup = function (mapConfigProvider, params, token) {
    let allLayers; // if layer is undefined then it fetchs all layers
    return this.tryFetchTileOrGrid(mapConfigProvider, params, token, 'mvt', allLayers);
};
