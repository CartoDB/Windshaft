'use strict';

const INCOMPATIBLE_LAYERS_ERROR = 'The `mapnik` or `cartodb` layers must be consistent:' +
    ' `cartocss` option is either present or voided in all layers. Mixing is not allowed.';

const MapConfigProviderProxy = require('../models/providers/mapconfig-provider-proxy');

module.exports = class MapValidatorBackend {
    constructor (tileBackend, attributesBackend) {
        this.tileBackend = tileBackend;
        this.attributesBackend = attributesBackend;
    }

    validate (mapConfigProvider, callback) {
        mapConfigProvider.getMapConfig((err, mapConfig, params) => {
            if (err) {
                return callback(err, false);
            }

            const token = mapConfig.id();

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

            const mapnikLayersIds = getMapnikLayerIds(mapConfig);

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
    }

    _validateRemaningFormatLayers (mapConfigProvider, mapConfig, params) {
        const token = mapConfig.id();
        const validateRemainingFormatLayerPromises = [];

        mapConfig.getLayers().forEach((layer, layerId) => {
            const layerOptions = layer.options;
            const layerType = mapConfig.layerType(layerId);

            if (layerType === 'mapnik') {
                if (layerOptions.interactivity) {
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
            if (layerOptions.attributes && !layerOptions.sql_raw) {
                validateRemainingFormatLayerPromises.push(
                    this.tryFetchFeatureAttributes(mapConfigProvider, params, token, layerId)
                );
            }
        });

        if (!validateRemainingFormatLayerPromises.length) {
            return Promise.resolve();
        }

        return Promise.all(validateRemainingFormatLayerPromises);
    }

    tryFetchTileOrGrid (mapConfigProvider, _params, token, format, layerId) {
        const params = Object.assign({}, _params);
        params.token = token;
        params.format = format;
        params.layer = layerId;
        params.x = 0;
        params.y = 0;
        params.z = 30;

        return new Promise((resolve, reject) => {
            const mapConfigProviderProxy = new MapConfigProviderProxy(mapConfigProvider, params);

            this.tileBackend.getTile(mapConfigProviderProxy, params, (err) => {
                if (err) {
                    // Grainstore returns styles error indicating layer index, since validation is performed
                    // one by one instead of all blended layers of MapConfig, this fixes the error message to
                    // show the right layer index.
                    if (err.message.match(/^style0: CartoCSS is empty/) && layerId > 0) {
                        err.message = err.message.replace(/style0/i, `style${layerId}`);
                    }
                    err.layerIndex = layerId;

                    return reject(err);
                }

                return resolve();
            });
        });
    }

    tryFetchFeatureAttributes (mapConfigProvider, _params, token, layernum) {
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
    }

    validateVectorLayergroup (mapConfigProvider, params, token) {
        let allLayers; // if layer is undefined then it fetchs all layers
        return this.tryFetchTileOrGrid(mapConfigProvider, params, token, 'mvt', allLayers);
    }
};

function getMapnikLayerIds (mapConfig) {
    const mapnikLayerIds = [];

    mapConfig.getLayers().forEach(function (layer, layerId) {
        if (mapConfig.layerType(layerId) === 'mapnik') {
            mapnikLayerIds.push(layerId);
        }
    });

    return mapnikLayerIds;
}
