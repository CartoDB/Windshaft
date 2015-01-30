var Crypto = require('crypto');
var semver = require('semver');

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

  if ( ! semver.satisfies(this.version(), '>= 1.0.0 <= 1.3.0') ) {
    throw new Error("Unsupported layergroup configuration version " + this.version());
  }

  if ( ! this._cfg.hasOwnProperty('layers') ) {
    throw new Error("Missing layers array from layergroup config");
  }
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

o.version = function() {
  return this._cfg.version || '1.0.0';
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
