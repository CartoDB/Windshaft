var step = require('step');
var queue = require('queue-async');
var _ = require('underscore');


function MapValidatorBackend(mapBackend) {
    this._mapBackend = mapBackend;
}

module.exports = MapValidatorBackend;


MapValidatorBackend.prototype.validate = function(params, mapConfig, callback) {

    var self = this;

    var testX = 0,
        testY = 0,
        testZ = 30;

    var token = mapConfig.id();

    var validateFnList = [];

    function validateMapnikTile() {
        return function(done) {
            self.tryFetchTileOrGrid(_.clone(params), token, testX, testY, testZ, 'png', undefined, done);
        };
    }

    function validateMapnikGridJson(layerId) {
        return function(done) {
            self.tryFetchTileOrGrid(_.clone(params), token, testX, testY, testZ, 'grid.json', layerId, done);
        };
    }

    function validateTorqueJson(layerId) {
        return function(done) {
            self.tryFetchTileOrGrid(_.clone(params), token, testX, testY, testZ, 'json.torque', layerId, done);
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

// Try fetching a grid
//
// @param req the request that created the layergroup
//
// @param layernum if undefined tries to fetch a tile,
//                 otherwise tries to fetch a grid or torque from the given layer
MapValidatorBackend.prototype.tryFetchTileOrGrid = function(params, token, x, y, z, format, layernum, callback) {
    var self = this;

    params.token = token;
    params.format = format;
    params.layer = layernum;
    params.x = x;
    params.y = y;
    params.z = z;

    step(
        function tryGet() {
            self._mapBackend.getTileOrGrid(params, this); // tryFetchTileOrGrid
        },
        function checkGet(err) {
            callback(err);
        }
    );
};

MapValidatorBackend.prototype.tryFetchFeatureAttributes = function(params, token, layernum, callback) {
    params.token = token;
    params.layer = layernum;

    this._mapBackend.getFeatureAttributes(params, true, callback);
};
