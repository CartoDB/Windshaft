var queue = require('queue-async');
var _ = require('underscore');

/**
 * @param {TileBackend} tileBackend
 * @param {AttributesBackend} attributesBackend
 * @param MapConfigProviderClass
 * @constructor
 */
function MapValidatorBackend(tileBackend, attributesBackend, MapConfigProviderClass) {
    this.tileBackend = tileBackend;
    this.attributesBackend = attributesBackend;
    this.MapConfigProviderClass = MapConfigProviderClass;
}

module.exports = MapValidatorBackend;

MapValidatorBackend.prototype.validate = function(params, mapConfig, callback) {

    var self = this;

    var token = mapConfig.id();

    var validateFnList = [];

    function validateMapnikTile() {
        return function(done) {
            self.tryFetchTileOrGrid(mapConfig, _.clone(params), token, 'png', undefined, done);
        };
    }

    function validateMapnikGridJson(layerId) {
        return function(done) {
            self.tryFetchTileOrGrid(mapConfig, _.clone(params), token, 'grid.json', layerId, done);
        };
    }

    function validateTorqueJson(layerId) {
        return function(done) {
            self.tryFetchTileOrGrid(mapConfig, _.clone(params), token, 'json.torque', layerId, done);
        };
    }

    function validateAttributes(layerId) {
        return function(done) {
            self.tryFetchFeatureAttributes(_.clone(params), token, layerId, done);
        };
    }

    var hasMapnikLayers = false;

    mapConfig.getLayers().forEach(function(layer, layerId) {

        var lyropt = layer.options;

        var layerType = mapConfig.layerType(layerId);

        if (layerType === 'mapnik') {

            if (!hasMapnikLayers) {
                validateFnList.push(validateMapnikTile());
                hasMapnikLayers = true;
            }

            if ( lyropt.interactivity ) {
                validateFnList.push(validateMapnikGridJson(layerId));
            }
        } else if (layerType === 'torque') {
            validateFnList.push(validateTorqueJson(layerId));
        }

        // both 'cartodb' or 'torque' types can have attributes
        if ( lyropt.attributes ) {
            validateFnList.push(validateAttributes(layerId));
        }
    });

    var validationQueue = queue(validateFnList.length);

    validateFnList.forEach(function(validateFn) {
        validationQueue.defer(validateFn);
    });

    function validationQueueFinish(err) {
        return callback(err, !err);
    }

    validationQueue.awaitAll(validationQueueFinish);
};

MapValidatorBackend.prototype.tryFetchTileOrGrid = function (mapConfig, params, token, format, layerId, callback) {
    params.token = token;
    params.format = format;
    params.layer = layerId;
    params.x = 0;
    params.y = 0;
    params.z = 30;

    this.tileBackend.getTile(new this.MapConfigProviderClass(mapConfig, params), params, callback);
};

MapValidatorBackend.prototype.tryFetchFeatureAttributes = function(params, token, layernum, callback) {
    params.token = token;
    params.layer = layernum;

    this.attributesBackend.getFeatureAttributes(params, true, callback);
};
