var Crypto = require('crypto');

// Map configuration object

/// API: Create MapConfig from configuration object
//
/// @param obj js MapConfiguration object
///
function MapConfig(cfg) {
  // TODO: check configuration ?
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
}

/// API: Get configuration object of this MapConfig
o.obj = function() {
  return this._cfg;
}

module.exports = MapConfig;
