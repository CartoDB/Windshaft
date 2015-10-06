var Crypto = require('crypto');
var semver = require('semver');

var Datasource = require('./datasource');

// Some regular expressions that are better compiled once
var mapnikTokens_RE = /!bbox!|!scale_denominator!|!pixel_width!|!pixel_height!/;

// Map configuration object

/// API: Create MapConfig from configuration object
//
/// @param obj js MapConfiguration object, see
///        http://github.com/CartoDB/Windshaft/wiki/MapConfig-specification
///
function MapConfig(config, datasource) {
  // TODO: inject defaults ?
  this._cfg = config;

  if ( ! semver.satisfies(this.version(), '>= 1.0.0 <= 1.5.0') ) {
    throw new Error("Unsupported layergroup configuration version " + this.version());
  }

  if ( ! this._cfg.hasOwnProperty('layers') ) {
    throw new Error("Missing layers array from layergroup config");
  }

  this._cfg.layers.forEach(function(layer, i) {
    if ( ! layer.hasOwnProperty('options') ) {
      throw new Error("Missing options from layer " + i + " of layergroup config");
    }
    // NOTE: interactivity used to be a string as of version 1.0.0
    if ( Array.isArray(layer.options.interactivity) ) {
      layer.options.interactivity = layer.options.interactivity.join(',');
    }
    // both 'cartodb' or 'torque' types can have attributes
    if ( layer.options.attributes ) {
      if ( layer.options.sql.match(mapnikTokens_RE) ) {
        throw new Error("Attribute service cannot be activated on layer " + i + ": using dynamic sql (mapnik tokens)");
      }
    }
  });

  this._datasource = datasource;

  this._id = null;
}

function md5Hash(s) {
  return Crypto.createHash('md5').update(s).digest('hex');
}

/// API: Get serialized version of this MapConfig
MapConfig.prototype.serialize = function() {
    if (this._datasource.isEmpty()) {
        return JSON.stringify(this._cfg);
    }
    return JSON.stringify({
        cfg: this._cfg,
        ds: this._datasource.obj()
    });
};

/// API: Get identifier for this MapConfig
MapConfig.prototype.id = function() {
  if (this._id === null) {
      this._id = md5Hash(JSON.stringify(this._cfg));
  }
  return this._id;
};

/// API: Get configuration object of this MapConfig
MapConfig.prototype.obj = function() {
  return this._cfg;
};

MapConfig.prototype.version = function() {
  return this._cfg.version || '1.0.0';
};

MapConfig.prototype.setDbParams = function(dbParams) {
    this._cfg.dbparams = dbParams;
    // flush id so it gets recalculated
    this._id = null;
};

/// API: Get type string of given layer
//
/// @param num layer index (0-based)
/// @returns a type string, as read from the layer
///
MapConfig.prototype.layerType = function(num) {
  var lyr = this.getLayer(num);
  if ( ! lyr ) {
      return undefined;
  }
  return this.getType(lyr.type);
};

MapConfig.prototype.getType = function(type) {
    // TODO: check validity of other types ?
    return (!type || type === 'cartodb') ? 'mapnik' : type;
};

/// API: Get layer by index
//
/// @returns undefined on invalid index
///
MapConfig.prototype.getLayer = function(num) {
  return this._cfg.layers[num];
};

MapConfig.prototype.getLayers = function() {
    return this._cfg.layers;
};

MapConfig.prototype.getLayerDatasource = function(layerId) {
    return this._datasource.getLayerDatasource(layerId);
};

function create(rawConfig) {
    if (rawConfig.ds) {
        return new MapConfig(rawConfig.cfg, new Datasource(rawConfig.ds));
    }
    return new MapConfig(rawConfig, Datasource.EmptyDatasource());
}

module.exports = MapConfig;
// Factory like method to create MapConfig objects when you are unsure about being
// able to provide all the MapConfig collaborators or you have to create a MapConfig
// object from a serialized version
module.exports.create = create;
