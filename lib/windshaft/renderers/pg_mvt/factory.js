var carto = require('carto');
var debug = require('debug')('windshaft:renderer:pg_mvt');
var _ = require('underscore');
var PSQL = require('cartodb-psql');
var step = require('step');
var format = require('../../utils/format');

var RendererParams = require('../renderer_params');

var sql = require('./sql');
var Renderer = require('./renderer');
var PSQLAdaptor = require('./psql_adaptor');
var BaseAdaptor = require('../base_adaptor');

var SubstitutionTokens = require('../../utils/substitution_tokens');

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
///     - dbPoolParams: database connection pool params
///          - size: maximum number of resources to create at any given time
///          - idleTimeout: max milliseconds a resource can go unused before it should be destroyed
///          - reapInterval: frequency to check for idle resources
///
function PgMvtFactory(options) {
    // jshint newcap:false
    this.options = options || {};
    _.defaults(this.options, {
        sqlClass: PSQLAdaptor(PSQL, options.dbPoolParams)
    });
    if (this.options.sqlClass) {
        this.sqlClass = this.options.sqlClass;
    }
}

module.exports = PgMvtFactory;

// TODO consider removal of this
var formatToRenderer = {
    'mvt': Renderer,
};

PgMvtFactory.prototype = {
    /// API: renderer name, use for information purposes
    name: 'pg_mvt',

    /// API: tile formats this module is able to render
    supported_formats: Object.keys(formatToRenderer),

    getName: function() {
        return this.name;
    },

    supportsFormat: function(format) {
        return !!formatToRenderer[format];
    },

    getAdaptor: function(renderer, format, onTileErrorStrategy) {
        return new BaseAdaptor(renderer, format, onTileErrorStrategy);
    },

    getRenderer: function(mapConfig, format, options, callback) {
        var dbParams = RendererParams.dbParamsFromReqParams(options.params);
        var layer = options.layer;

        if (_.isUndefined(layer)) {
            // TODO review this error message
            return callback(new Error("pg_mvt renderer only supports a single layer"));
        }
        if (!formatToRenderer[format]) {
            return callback(new Error("format not supported: " + format));
        }
        var layerObj = mapConfig.getLayer(layer);
        if ( ! layerObj ) {
            return callback(new Error("layer index is greater than number of layers"));
        }
        // NOTE I'd use cartodb (supported for BW-compat). See https://github.com/CartoDB/Windshaft/blob/master/doc/MapConfig-1.5.0.md
        // TODO do it properly
        if ( layerObj.type !== 'mapnik' ) {
            return callback(new Error("layer " + layer + " is not a mapnik layer"));
        }

        _.extend(dbParams, mapConfig.getLayerDatasource(layer));

        var pgSQL = sql(dbParams, this.sqlClass);
        // TODO we don't really need such params
        fetchMapConfigAttributes(pgSQL, layerObj, function (err, params) {
            if (err) {
                return callback(err);
            }

            var RendererClass = formatToRenderer[format];

            callback(null, new RendererClass(layerObj, pgSQL, params, layer));
        });
    }
};


//
// check layer and raise an exception is some error is found
//
// @throw Error if missing or malformed CartoCSS
//
function _checkLayerAttributes(layerConfig) {
  var cartoCSS = layerConfig.options.cartocss;
  if (!cartoCSS) {
    throw new Error("cartocss can't be undefined");
  }
  var checks = ['steps', 'resolution', 'column', 'countby'];
  return attrsFromCartoCSS(cartoCSS, checks);
}

// returns an array of errors if the mapconfig is not supported or contains errors
// errors is empty is the configuration is ok
// dbParams: host, dbname, user and pass
// layer: optional, if is specified only a layer is checked
function fetchMapConfigAttributes(sql, layer, callback) {
  // check attrs
  var attrs;
  try {
      attrs = _checkLayerAttributes(layer);
  }  catch (e) {
      return callback(e);
  }

  // fetch layer attributes to check the query and so on is ok
  var layer_sql = layer.options.sql;
  fetchLayerAttributes(sql, layer_sql, attrs, function(err, layerAttrs) {
    if (err) {
      return callback(err);
    }
    callback(null, _.extend(attrs, layerAttrs));
  });
}

function fetchLayerAttributes(sql, layer_sql, attrs, callback) {
  var is_time;

  layer_sql = SubstitutionTokens.replace(layer_sql, {
      bbox: 'ST_MakeEnvelope(0,0,0,0)',
      scale_denominator: '0',
      pixel_width: '1',
      pixel_height: '1',
      var_zoom: '0',
      var_bbox: '[-20037508.34,-20037508.34,20037508.34,20037508.34]',
      var_x: '0',
      var_y: '0'
  });

  step(

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
    if (err) {
        throw err;
    }
    if ( ! data ) {
        debug("ERROR: layer query '" + layer_sql + "' returned no data");
        throw new Error("Layer query returned no data");
    }
    if ( ! data.fields.hasOwnProperty(attrs.column) ) {
        debug("ERROR: layer query " + layer_sql + " does not include time-attribute column '" + attrs.column + "'");
        throw new Error("Layer query did not return the requested time-attribute column '" + attrs.column + "'");
    }
    is_time = data.fields[attrs.column].type === 'date';
    var column_conv = attrs.column;
    var max_tmpl, min_tmpl;
    if (is_time){
      max_tmpl = "date_part('epoch', max({column}))";
      min_tmpl = "date_part('epoch', min({column}))";
      column_conv = format("date_part('epoch', {column})", attrs);
    } else {
      max_tmpl = "max({column})";
      min_tmpl = "min({column})";
    }

    var max_col = format(max_tmpl, { column: attrs.column });
    var min_col = format(min_tmpl, { column: attrs.column });
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
      if ( err.message ) {
          err.message = 'TorqueRenderer: ' + err.message;
      }
      return callback(err);
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
