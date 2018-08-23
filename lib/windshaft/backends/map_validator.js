var step = require('step');
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
    var self = this;

    mapConfigProvider.getMapConfig(function(err, mapConfig, params) {
        if (err) {
            return callback(err, false);
        }

        var token = mapConfig.id();

        if (mapConfig.isVectorOnlyMapConfig()) {
            return self.validateVectorLayergroup(mapConfigProvider, params, token, callback);
        }

        if (mapConfig.hasIncompatibleLayers()) {
            const error = new Error(INCOMPATIBLE_LAYERS_ERROR);
            error.type = 'mapconfig';
            error.http_status = 400;
            return callback(error);
        }

        function validateMapnikTile(layerId) {
            return function(done) {
                self.tryFetchTileOrGrid(mapConfigProvider, _.clone(params), token, 'png', layerId, done);
            };
        }



        var mapnikLayersIds = getMapnikLayerIds(mapConfig);

        step(
            function validate$allMapnikTileLayers () {
              var next = this;

              if (!mapnikLayersIds.length) {
                  return next();
              }

              var validateAllMapnikTileLayers = validateMapnikTile();
              validateAllMapnikTileLayers(next);
            },
            function validate$checkFailingMapnikTileLayer (errAllLayers) {
                var next = this;

                if (!errAllLayers) {
                    return next();
                }

                var checkFailingMapnikTileLayerFns = [];
                mapnikLayersIds.forEach(function (layerId) {
                    checkFailingMapnikTileLayerFns.push(validateMapnikTile(layerId));
                });

                var checkFailingMapnikLayerQueue = queue(checkFailingMapnikTileLayerFns.length);
                checkFailingMapnikTileLayerFns.forEach(function (validateFn) {
                    checkFailingMapnikLayerQueue.defer(validateFn);
                });

                checkFailingMapnikLayerQueue.awaitAll(function (err) {
                    // err from failing layer || err from all mapnik layers
                    return next(err || errAllLayers);
                });
            },
            function validate$remaningFormatLayers (err) {
                var next = this;

                if (err) {
                    return next(err);
                }

                self._validateRemaningFormatLayers(mapConfigProvider, mapConfig, params, this);
            },
            function validate$finish (err) {
                return callback(err, !err);
            }
        );
    });
};

MapValidatorBackend.prototype._validateRemaningFormatLayers = function(mapConfigProvider, mapConfig, params, callback) {
    var self = this;
    var token = mapConfig.id();

    function validateMapnikGridJson(layerId) {
        return function(done) {
            self.tryFetchTileOrGrid(mapConfigProvider, _.clone(params), token, 'grid.json', layerId, done);
        };
    }

    function validateTorqueJson(layerId) {
        return function(done) {
            self.tryFetchTileOrGrid(mapConfigProvider, _.clone(params), token, 'json.torque', layerId, done);
        };
    }

    function validateAttributes(layerId) {
        return function(done) {
            self.tryFetchFeatureAttributes(mapConfigProvider, _.clone(params), token, layerId, done);
        };
    }

    var validateRemainingFormatLayerFns = [];

    mapConfig.getLayers().forEach(function(layer, layerId) {
        var lyropt = layer.options;
        var layerType = mapConfig.layerType(layerId);

        if (layerType === 'mapnik') {
            if ( lyropt.interactivity ) {
                validateRemainingFormatLayerFns.push(validateMapnikGridJson(layerId));
            }
        } else if (layerType === 'torque') {
            validateRemainingFormatLayerFns.push(validateTorqueJson(layerId));
        }

        // both 'cartodb' or 'torque' types can have attributes
        // attribute validation is usually very inefficient when sql_raw if present so we skip it
        if (lyropt.attributes && !lyropt.sql_raw) {
            validateRemainingFormatLayerFns.push(validateAttributes(layerId));
        }
    });

    var validationQueue = queue(validateRemainingFormatLayerFns.length);
    validateRemainingFormatLayerFns.forEach(function(validateFn) {
        validationQueue.defer(validateFn);
    });

    validationQueue.awaitAll(function (err) {
        return callback(err);
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

MapValidatorBackend.prototype.tryFetchTileOrGrid = function (mapConfigProvider, params, token, format, layerId,
                                                             callback) {
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

MapValidatorBackend.prototype.tryFetchFeatureAttributes = function(mapConfigProvider, params, token, layernum,
                                                                   callback) {
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

    this.tryFetchTileOrGrid(mapConfigProvider, _.clone(params), token, 'mvt', allLayers, (err) => {
        if (err && err.message === 'Tile does not exist') {
            return callback(null, true);
        }

        if (err) {
            return callback(err, false);
        }

        callback(null, true);
    });
};
