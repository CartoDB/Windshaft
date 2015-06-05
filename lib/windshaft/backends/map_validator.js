var step = require('step');
var queue = require('queue-async');
var _ = require('underscore');

var ProfilerProxy = require('../stats/profiler_proxy');
var fakeProfiler = new ProfilerProxy({profile: false});

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
        };
    }

    function validateMapnikGridJson(layerId) {
        return function(done) {
            self.tryFetchTileOrGrid(cloneObjectParams(req), token, testX, testY, testZ, 'grid.json', layerId, done);
        };
    }

    function validateTorqueJson(layerId) {
        return function(done) {
            self.tryFetchTileOrGrid(cloneObjectParams(req), token, testX, testY, testZ, 'json.torque', layerId, done);
        };
    }

    function validateAttributes(layerId) {
        return function(done) {
            self.tryFetchFeatureAttributes(cloneObjectParams(req), token, layerId, done);
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

function cloneObjectParams(req) {
    req = _.clone(req);
    req.params = _.clone(req.params);
    req.profiler = fakeProfiler;
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

    step(
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
            var statusCode = typeof(arguments[1]) === 'object' ? arguments[2] : arguments[1];
            if ( statusCode === 200 ) {
                callback();
            } else {
                callback(new Error(body.errors[0]));
            }
        }
    };

    // TODO: deep-clone req, rather than hijack like this ?
    req.params.token = token;
    req.params.layer = layernum;
    //req.params.fid = ;

    this._mapBackend.getFeatureAttributes(req, customres, true);
};
