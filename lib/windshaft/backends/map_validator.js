var queue = require('queue-async');
var _ = require('underscore');

const INCOMPATIBLE_LAYERS_ERROR = 'The `mapnik` or `cartodb` layers must be consistent:' +
    ' `cartocss` option is either present or voided in all layers. Mixing is not allowed.';

var MapConfigProviderProxy = require('../models/providers/mapconfig_provider_proxy');

/**
 * @param {TileBackend} tileBackend
 * @param {AttributesBackend} attributesBackend
 * @constructor
 * @type {MapValidatorBackend}
 */
function MapValidatorBackend(tileBackend, attributesBackend) {
    this.tileBackend = tileBackend;
    this.attributesBackend = attributesBackend;
}

module.exports = MapValidatorBackend;

MapValidatorBackend.prototype.validate = function(mapConfigProvider, callback) {
    mapConfigProvider.getMapConfig((err, mapConfig, params) => {
        if (err) {
            return callback(err, false);
        }

        var token = mapConfig.id();

        if (mapConfig.isVectorOnlyMapConfig()) {
            return this.validateVectorLayergroup(mapConfigProvider, params, token, callback);
        }

        if (mapConfig.hasIncompatibleLayers()) {
            const error = new Error(INCOMPATIBLE_LAYERS_ERROR);
            error.type = 'mapconfig';
            error.http_status = 400;
            return callback(error);
        }

        var mapnikLayersIds = getMapnikLayerIds(mapConfig);

        if (!mapnikLayersIds.length) {
            return this._validateRemaningFormatLayers(mapConfigProvider, mapConfig, params, callback);
        }

        this.tryFetchTileOrGrid(mapConfigProvider, params, token, 'png', undefined, errAllLayers => {
            if (!errAllLayers) {
                return this._validateRemaningFormatLayers(mapConfigProvider, mapConfig, params, callback);
            }

            var checkFailingMapnikTileLayerFns = mapnikLayersIds.map(layerId => {
                return done => this.tryFetchTileOrGrid(mapConfigProvider, params, token, 'png', layerId, done);
            });

            var checkFailingMapnikLayerQueue = queue(checkFailingMapnikTileLayerFns.length);
            checkFailingMapnikTileLayerFns.forEach(function (validateFn) {
                checkFailingMapnikLayerQueue.defer(validateFn);
            });

            checkFailingMapnikLayerQueue.awaitAll(function (errOneLayer) {
                const err = errOneLayer || errAllLayers;
                return callback(err, !err);
            });
        });
    });
};

MapValidatorBackend.prototype._validateRemaningFormatLayers = function(mapConfigProvider, mapConfig, params, callback) {
    var token = mapConfig.id();

    var validateRemainingFormatLayerFns = [];

    mapConfig.getLayers().forEach((layer, layerId) => {
        var lyropt = layer.options;
        var layerType = mapConfig.layerType(layerId);

        if (layerType === 'mapnik') {
            if (lyropt.interactivity) {
                validateRemainingFormatLayerFns.push(
                    done => this.tryFetchTileOrGrid(mapConfigProvider, params, token, 'grid.json', layerId, done)
                );
            }
        } else if (layerType === 'torque') {
            validateRemainingFormatLayerFns.push(
                done => this.tryFetchTileOrGrid(mapConfigProvider, params, token, 'json.torque', layerId, done)
            );
        }

        // both 'cartodb' or 'torque' types can have attributes
        // attribute validation is usually very inefficient when sql_raw if present so we skip it
        if (lyropt.attributes && !lyropt.sql_raw) {
            validateRemainingFormatLayerFns.push(
                done => this.tryFetchFeatureAttributes(mapConfigProvider, params, token, layerId, done)
            );
        }
    });

    var validationQueue = queue(validateRemainingFormatLayerFns.length);
    validateRemainingFormatLayerFns.forEach(function(validateFn) {
        validationQueue.defer(validateFn);
    });

    validationQueue.awaitAll(function (err) {
        return callback(err, !err);
    });
};

function getMapnikLayerIds(mapConfig) {
    var mapnikLayerIds = [];

    mapConfig.getLayers().forEach(function(layer, layerId) {
        if (mapConfig.layerType(layerId) === 'mapnik') {
            mapnikLayerIds.push(layerId);
        }
    });

    return mapnikLayerIds;
}

MapValidatorBackend.prototype.tryFetchTileOrGrid = function (mapConfigProvider, _params, token, format, layerId,
                                                             callback) {
    let params = _.clone(_params);
    params.token = token;
    params.format = format;
    params.layer = layerId;
    params.x = 0;
    params.y = 0;
    params.z = 30;

    this.tileBackend.getTile(new MapConfigProviderProxy(mapConfigProvider, params), params, function (err) {
        if (err) {
            // Grainstore returns styles error indicating layer index, since validation is performed
            // one by one instead of all blended layers of MapConfig, this fixes the error message to
            // show the right layer index.
            if (err.message.match(/^style0: CartoCSS is empty/) && layerId > 0) {
                err.message = err.message.replace(/style0/i, 'style' + layerId);
            }
            err.layerIndex = layerId;
            return callback(err);
        }
        callback();
    });
};

MapValidatorBackend.prototype.tryFetchFeatureAttributes = function(mapConfigProvider, _params, token, layernum,
                                                                   callback) {

    let params = _.clone(_params);
    params.token = token;
    params.layer = layernum;

    var proxyProvider = new MapConfigProviderProxy(mapConfigProvider, params);
    this.attributesBackend.getFeatureAttributes(proxyProvider, params, true, function (err) {
        if (err) {
            err.layerIndex = layernum;
            return callback(err);
        }
        callback();
    });
};

MapValidatorBackend.prototype.validateVectorLayergroup = function (mapConfigProvider, params, token, callback) {
    let allLayers; // if layer is undefined then it fetchs all layers

    this.tryFetchTileOrGrid(mapConfigProvider, params, token, 'mvt', allLayers, (err) => {
        if (err && err.message === 'Tile does not exist') {
            return callback(null, true);
        }

        if (err) {
            return callback(err, false);
        }

        callback(null, true);
    });
};
