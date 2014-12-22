var Crypto = require('crypto');

// Map configuration object

/// API: Create MapConfig from configuration object
//
/// @param obj js MapConfiguration object, see
///        http://github.com/CartoDB/Windshaft/wiki/MapConfig-specification
///
function MapConfig(cfg) {
  // TODO: check configuration ?
  // TODO: inject defaults ?
  this._cfg = cfg;
}

var o = MapConfig.prototype;

o._md5 = function(s) {
  return Crypto.createHash('md5').update(s).digest('hex');
};

/// API: Get serialized version of this MapConfig
o.serialize = function() {
  return JSON.stringify(this._cfg);
};

/// API: Get identifier for this MapConfig
o.id = function() {
  return this._md5(this.serialize());
};

/// API: Get configuration object of this MapConfig
o.obj = function() {
  return this._cfg;
};

/// API: Get type string of given layer
//
/// @param num layer index (0-based)
/// @returns a type string, as read from the layer
///
o.layerType = function(num) {
  var lyr = this.getLayer(num);
  if ( ! lyr ) return undefined;
  var typ = lyr.type;
  if ( ! typ || typ == 'cartodb' ) typ = 'mapnik';
  // TODO: check validity of other types ?
  return typ;
};

/// API: Get layer by index 
//
/// @returns undefined on invalid index
///
o.getLayer = function(num) {
  return this._cfg.layers[num];
};

o.getLayers = function() {
    return this._cfg.layers;
};


module.exports = MapConfig;
