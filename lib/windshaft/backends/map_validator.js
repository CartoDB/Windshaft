var Step = require('step');
var queue = require('queue-async');
var _ = require('underscore');


function MapValidatorBackend(mapBackend) {
    this._mapBackend = mapBackend;
}

module.exports = MapValidatorBackend;


MapValidatorBackend.prototype.validate = function(req, mapConfig, callback) {

    var self = this;

    var testX = 0,
        testY = 0,
        testZ = 30;


    var token = mapConfig.id();

    var validateFnList = [];

    function validateMapnikTile() {
        return function(done) {
            self.tryFetchTileOrGrid(cloneObjectParams(req), token, testX, testY, testZ, 'png', undefined, done);
        }
    }

    function validateMapnikGridJson(layerId) {
        return function(done) {
            self.tryFetchTileOrGrid(cloneObjectParams(req), token, testX, testY, testZ, 'grid.json', layerId, done);
        }
    }

    function validateTorqueJson(layerId) {
        return function(done) {
            self.tryFetchTileOrGrid(cloneObjectParams(req), token, testX, testY, testZ, 'json.torque', layerId, done);
        }
    }

    function validateAttributes(layerId) {
        return function(done) {
            self.tryFetchFeatureAttributes(cloneObjectParams(req), token, layerId, done);
        }
    }

    var hasMapnikLayers = false,
        gridLayerIndex = 0;

    mapConfig.getLayers().forEach(function(layer, layerId) {

        var lyropt = layer.options;

        var layerType = mapConfig.layerType(layerId);

        if (layerType === 'mapnik') {

            if (!hasMapnikLayers) {
                validateFnList.push(validateMapnikTile());
                hasMapnikLayers = true;
            }

            if ( lyropt.interactivity ) {
                // -------------------------------------------------------------------------------
                // ### Why not use `i` variable for grid layers as in `attributes` or `torque` ###
                // -------------------------------------------------------------------------------
                // It's expected that all cartodb/mapnik layers start from index 0 and layers with a different
                // type are always at the end of the layers list.
                // If that's not the case, for instance with a mapconfig with layers [torque:0,mapnik:0,mapnik:1]
                // using `i` variable we would set gridLayers=[1,2] but the internal data structures will have
                // [mapnik:0,mapnik:1], so when trying to get the grid for mapnik:0 it will get the interactivity
                // for mapnik:1 because we said it was in index=1, and when trying to get the grid for mapnik:1 it
                // will fail because it will try to reach index=2 in the internal data structure, which actually
                // has only two elements. That's why we set the grid layer in a zero based index.
                // This change ensures all previous scenarios where mapnik layers were the first elements of the
                // list will continue working as before because all mapnik/cartodb layers will start from index=0.
                validateFnList.push(validateMapnikGridJson(gridLayerIndex))
            }
            // If mapnik/cartodb layer has no interactivity we want to skip to next one as well
            gridLayerIndex++;
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

function cloneObjectParams(req) {
    req = _.clone(req);
    req.params = _.clone(req.params);
    return req;
}

// Try fetching a grid
//
// @param req the request that created the layergroup
//
// @param layernum if undefined tries to fetch a tile,
//                 otherwise tries to fetch a grid or torque from the given layer
MapValidatorBackend.prototype.tryFetchTileOrGrid = function(req, token, x, y, z, format, layernum, callback) {
    var self = this;

    var customres = {
        header: function() {},
        send: function(){ }
    };

    // TODO: deep-clone req, rather than hijack like this ?
    req.params.token = token;
    req.params.format = format;
    req.params.layer = layernum;
    req.params.x = x;
    req.params.y = y;
    req.params.z = z;

    Step(
        function tryGet() {
            self._mapBackend.getTileOrGrid(req, customres, this); // tryFetchTileOrGrid
        },
        function checkGet(err) {
            callback(err);
        }
    );
};

MapValidatorBackend.prototype.tryFetchFeatureAttributes = function(req, token, layernum, callback) {

    var customres = {
        header: function() {},
        send: function(body) {
            // NOTE: this dancing here is to support express-2.5.x
            // FIXME: simplify taking second argument as statusCode once we upgrade to express-3.x.x
            var statusCode = typeof(arguments[1]) == 'object' ? arguments[2] : arguments[1];
            if ( statusCode == 200 ) {
                callback();
            } else {
                callback(new Error(body.error));
            }
        }
    };

    // TODO: deep-clone req, rather than hijack like this ?
    req.params.token = token;
    req.params.layer = layernum;
    //req.params.fid = ;

    this._mapBackend.getFeatureAttributes(req, customres, true);
};
