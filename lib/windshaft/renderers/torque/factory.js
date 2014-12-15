var carto = require('carto');
var _ = require('underscore');
var PSQL = require('cartodb-psql');
var Step = require('step');
var torque_reference = require('torque.js').cartocss_reference;
var format = require('../../utils/format');

var sql = require('./sql');
var Renderer = require('./renderer');
var PSQLAdaptor = require('./psql_adaptor');

/// API: initializes the renderer, it should be called once
//
/// @param options initialization options.
///     - sqlClass: class used to access postgres, by default is PSQL
///         the class should provide the following interface
///          - constructor(params) where params should contain:
///            host, port, database, user, password.
///            the class is always constructed with dbParams passed to
///            getRender as-is
///          - query(sql, callback(err, data), readonly)
///            gets an SQL query and return a javascript object with
///            the same structure of a JSON format response from
///            CartoDB-SQL-API, for reference see
///            http://github.com/CartoDB/CartoDB-SQL-API/blob/1.8.2/doc/API.md#json
///            The 'readonly' parameter (false by default) requests
///            that running the query should not allowed to change the database.
///
function TorqueFactory(options) {
    this.options = options || {};
    _.defaults(this.options, {
        sqlClass: PSQLAdaptor(PSQL)
    });
    if (this.options.sqlClass) {
        this.sqlClass = this.options.sqlClass;
    }
}

module.exports = TorqueFactory;


TorqueFactory.prototype = {
    /// API: renderer name, use for information pourposes
    name: 'torque',

    /// API: tile formats this module is able to render
    // TODO: deprecate 'json.torque' and 'bin.torque' with 1.18.0
    supported_formats: ['torque.json', 'torque.bin', 'json.torque', 'bin.torque'],

    /// API: creates a renderer
    //
    /// @param mapConfig json object with full mapConfig
    /// @param dbParams json object with database connection params
    ///                 (host, port, dbname, user and pass)
    /// @param format one of the supported_formats
    /// @param layer layer index inside mapConfig (optional)
    /// @param callback function(err, renderer) called when method finishes
    getRenderer: function(mapConfig, dbParams, format, layer, callback) {
        if (arguments.length === 4) {
            callback = layer;
            callback(new Error("torque renderer only supports a single layer"));
            return;
        }
        if (!_.contains(this.supported_formats, format)) {
            callback(new Error("format not supported: " + format));
            return;
        }
        var layerObj = mapConfig.layers[layer];
        if ( ! layerObj ) {
            callback(new Error("layer index is greater than number of layers"));
            return;
        }
        if ( layerObj.type !== 'torque' ) {
            callback(new Error("layer " + layer + " is not a torque layer"));
            return;
        }
        var pgSQL = sql(dbParams, this.sqlClass);
        fetchMapConfigAttributes(pgSQL, mapConfig, dbParams, layer, function(err, params){
            if (err) {
                callback(err);
                return;
            }
            callback(null, new Renderer(layerObj, pgSQL, params, layer));
        });
    }

};

//
// given cartocss return javascript properties
//
// @param required optional array of required properties
//
// @throw Error if required properties are not found
//
function attrsFromCartoCSS(cartocss, required) {
  var attrs_keys = {
    '-torque-frame-count': 'steps',
    '-torque-resolution': 'resolution',
    '-torque-animation-duration': 'animationDuration',
    '-torque-aggregation-function': 'countby',
    '-torque-time-attribute': 'column',
    '-torque-data-aggregation': 'data_aggregation'
  };
  carto.tree.Reference.setData(torque_reference.version.latest);
  var env = {
      benchmark: false,
      validation_data: false,
      effects: [],
      errors: [],
      error: function(e) {
        this.errors.push(e);
      }
  };
  var root = (carto.Parser(env)).parse(cartocss);
  var definitions = root.toList(env);
  var rules = getMapProperties(definitions, env);
  var attrs = {};
  for (var k in attrs_keys) {
    if (rules[k]) {
      attrs[attrs_keys[k]] = rules[k].value.toString();
    } else if ( required && required.indexOf(attrs_keys[k]) != -1 ) {
        throw new Error("Missing required property '" + k + "' in torque layer CartoCSS");
    }
  }
  return attrs;
}


//
// get rules from Map definition
// stores errors in env.error
// 
function getMapProperties(definitions, env) {
  var rules = {};
  definitions.filter(function(r) {
      return r.elements.join('') === 'Map';
  }).forEach(function(r) {
      for (var i = 0; i < r.rules.length; i++) {
          var key = r.rules[i].name;
          rules[key] = r.rules[i].ev(env);
      }
  });
  return rules;
}


//
// check layer and raise an exception is some error is found
// 
// @throw Error if missing or malformed CartoCSS
//
function _checkLayerAttributes(layerConfig) {
  var cartoCSS = layerConfig.options.cartocss;
  if (!cartoCSS)
    throw Error("cartocss can't be undefined");
  var checks = ['steps', 'resolution', 'column', 'countby'];
  return attrsFromCartoCSS(cartoCSS, checks);
}

// returns an array of errors if the mapconfig is not supported or contains errors
// errors is empty is the configuration is ok
// dbParams: host, dbname, user and pass 
// layer: optional, if is specified only a layer is checked
function fetchMapConfigAttributes(sql, mapConfig, dbParams, layer_id, callback) {


  // only one layer supported
  var layer = mapConfig.layers[layer_id];

  if (!layer) {
    callback(new Error("mapconfig does not contain any torque layer"));
    return;
  }

  // check attrs
  try { var attrs = _checkLayerAttributes(layer); } 
  catch (e) { callback(e); return; }

  // fetch layer attributes to check the query and so on is ok
  var layer_sql = layer.options.sql;
  fetchLayerAttributes(sql, layer_sql, attrs, function(err, layerAttrs) {
    if (err) {
      callback(err);
      return;
    }
    callback(null, _.extend(attrs, layerAttrs));
  });
}

function fetchLayerAttributes(sql, layer_sql, attrs, callback) {
  var is_time;

  Step(

  //
  // first step, fetch the schema to know if torque colum is time column
  //
  function fetchSqlSchema() {
    var query = format("select * from ({sql}) __torque_wrap_sql limit 0", { sql: layer_sql });
    sql(query, this);
  },

  //
  // second step, get time bounds to calculate step
  //
  function fetchProps(err, data) {
    if (err) throw err;
    if ( ! data ) {
      console.log("ERROR: layer query '" + layer_sql + "' returned no data");
      throw new Error("Layer query returned no data");
    }
    if ( ! data.fields.hasOwnProperty(attrs.column) ) {
      console.log("ERROR: layer query " + layer_sql +
        " does not include time-attribute column '" + attrs.column + "'");
      throw new Error(
        "Layer query did not return the requested time-attribute column '"
        + attrs.column + "'");
    }
    is_time = data.fields[attrs.column].type === 'date';
    var column_conv = attrs.column;
    if (is_time){
      max_tmpl = "date_part('epoch', max({column}))";
      min_tmpl = "date_part('epoch', min({column}))";
      column_conv = format("date_part('epoch', {column})", attrs);
    } else {
      max_tmpl = "max({column})";
      min_tmpl = "min({column})";
    }

    max_col = format(max_tmpl, { column: attrs.column });
    min_col = format(min_tmpl, { column: attrs.column });
    var sql_stats = " SELECT " +
        "count(*) as num_steps, " +
        "{max_col} max_date, " +
        "{min_col} min_date FROM  ({sql}) __torque_wrap_sql ";

    var query = format(sql_stats, {
      max_col: max_col,
      min_col: min_col,
      column: column_conv,
      sql: layer_sql
    });
    sql(query, this);
  },

  //
  // prepare metadata needed to render the tiles
  //
  function generateMetadata(err, data) {
    if(err) { 
      if ( err.message ) err.message = 'TorqueRenderer: ' + err.message;
      callback(err);
      return;
    }
    data = data.rows[0];
    var step = (data.max_date - data.min_date + 1)/Math.min(attrs.steps, data.num_steps>>0);
    step = Math.abs(step) === Infinity ? 0 : step;
    callback(null, {
      start: data.min_date,
      end: data.max_date,
      step: step || 1,
      data_steps: data.num_steps >> 0,
      is_time: is_time
    });
  });
}
