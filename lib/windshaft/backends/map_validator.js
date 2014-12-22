var Step = require('step');


function MapValidatorBackend(mapBackend) {
    this._mapBackend = mapBackend;
}

module.exports = MapValidatorBackend;


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
