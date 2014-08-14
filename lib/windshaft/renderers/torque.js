var carto = require('carto');
var _ = require('underscore');
var PSQL = require('cartodb-psql');
var Step = require('step');
var torque_reference = require('torque.js').cartocss_reference;

function PSQLAdaptor(psqlClass) {
  var ctor = function(params) {
    this._psql = new psqlClass(params);
  }
  ctor.prototype.query = function(sql, callback, readonly) {
    this._psql.query(sql, this._handleResult.bind(this, callback), readonly);
  };
  ctor.prototype._handleResult = function(callback, err, result) {
    if ( err ) { callback(err); return; }
    var formatted = {
      fields: this._formatResultFields(result.fields),
      rows: result.rows
    };
    callback(null, formatted);
  };
  ctor.prototype._formatResultFields = function(flds) {
    var nfields = {};
    for (var i=0; i<flds.length; ++i) {
      var f = flds[i];
      var cname = this._psql.typeName(f.dataTypeID);
      var tname;
      if ( ! cname ) {
        tname = 'unknown(' + f.dataTypeID + ')';
      } else {
        if ( cname.match('bool') ) {
          tname = 'boolean';
        }
        else if ( cname.match(/int|float|numeric/) ) {
          tname = 'number';
        }
        else if ( cname.match(/text|char|unknown/) ) {
          tname = 'string';
        }
        else if ( cname.match(/date|time/) ) {
          tname = 'date';
        }
        else {
          tname = cname;
        }
        if ( tname && cname.match(/^_/) ) {
          tname += '[]';
        }
      }
      //console.log('cname:'+cname+' tname:'+tname);
      nfields[f.name] = { type: tname };
    }
    return nfields;
  }

  return ctor;
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
  var attrs = attrsFromCartoCSS(cartoCSS, checks);
  return attrs;
}

/// CLASS: torque Renderer
//
/// A renderer for a given MapConfig layer 
///
function Renderer(layer, sql, attrs) {
  this.sql = sql;
  this.attrs = attrs;
  this.layer_sql = layer.options.sql;
  //TODO: take defaults as parameters
  this.tile_size = 256;
  this.tile_max_geosize = 40075017; // earth circumference in webmercator 3857
  this.geom_column = layer.options.geom_column || 'the_geom_webmercator'; 
  this.geom_column_srid = layer.options.srid || 3857;
}

Renderer.prototype = {
  /// API: renders a tile with the Renderer configuration
  /// @param x tile x coordinate
  /// @param y tile y coordinate
  /// @param z tile zoom 
  /// callback: will be called when done using nodejs protocol (err, data)
  getTile: function(z, x, y, callback) {
    this.getTileData(this.sql, {x: x, y: y}, z, this.layer_sql, this.attrs, callback);
  },

  /// API: returns metadata for this renderer
  //
  /// Metadata for a torque layer is an object
  /// with the following elements:
  ///   - start  ??
  ///   - end    ??
  ///   - data_steps ??
  ///   - column_type ??
  ///
  /// TODO: document the meaning of each !
  ///
  getMetadata: function(callback) {
    var a = this.attrs;
    var meta = {
      start: a.start * 1000,
      end: a.end * 1000,
      data_steps: a.data_steps >> 0,
      column_type: a.is_time ? 'date': 'number'
    };
    callback(null, meta);
  },

  getTileData: function(sql, coord, zoom, layer_sql, attrs, callback) {
    //var prof_fetch_time = Profiler.metric('ProviderJSON:tile_fetch_time').start()
    

    var column_conv = attrs.column;

    if(attrs.is_time) {
      column_conv = format("date_part('epoch', {column})", attrs);
    }

    var tile_size = this.tile_size;
    var tile_max_geosize = this.tile_max_geosize;
    var geom_column = this.geom_column;
    var geom_column_srid = this.geom_column_srid;

    function CDB_XYZ_Resolution(z) {
      var full_resolution = tile_max_geosize / tile_size;
      return full_resolution / Math.pow(2, z);
    }

    function CDB_XYZ_Extent(x, y, z) {
        var initial_resolution = CDB_XYZ_Resolution(0);
        var origin_shift = (initial_resolution * tile_size) / 2.0;

        var pixres = initial_resolution / Math.pow(2,z);
        var tile_geo_size = tile_size * pixres;

        var xmin = -origin_shift + x*tile_geo_size;
        var xmax = -origin_shift + (x+1)*tile_geo_size;

        var ymin = origin_shift - y*tile_geo_size;
        var ymax = origin_shift - (y+1)*tile_geo_size;
        return {
          xmin: xmin, ymin: ymin, xmax: xmax, ymax: ymax
        };
    }

    var tile_sql = "" +
      "WITH " +
      "par AS (" +
      "  SELECT ({xyz_resolution})*{resolution} as res" +
      //", CDB_XYZ_Extent({x}, {y}, {zoom}) as ext "  +
      ", ST_MakeEnvelope({xmin}, {ymin}, {xmax}, {ymax}, {srid}) as ext ), " +
      "cte AS ( "+
      "  SELECT ST_SnapToGrid(i.{gcol}, p.res) g" +
      ", {countby} c" +
      ", floor(({column_conv} - {start})/{step}) d" +
      "  FROM ({_sql}) i, par p " +
      // We expand the extent by half the resolution
      // to include points that would fall within the
      // extent on grid snapping
      "  WHERE i.{gcol} && ST_Expand(p.ext, p.res/2) " +
      "  GROUP BY g, d" +
      ") " +
      "" +
      "SELECT (st_x(g)-st_xmin(p.ext))/p.res x__uint8, " +
      "       (st_y(g)-st_ymin(p.ext))/p.res y__uint8," +
      " array_agg(c) vals__uint8," +
      " array_agg(d) dates__uint16" +
      " FROM cte, par p" +
      " WHERE ST_X(cte.g) < ST_XMAX(p.ext) " +
      "   AND ST_Y(cte.g) < ST_YMAX(p.ext) " +
      " GROUP BY x__uint8, y__uint8";


    var query = format(tile_sql, attrs, {
      zoom: zoom,
      x: coord.x,
      y: coord.y,
      column_conv: column_conv,
      _sql: layer_sql,
      xyz_resolution: CDB_XYZ_Resolution(zoom),
      srid: geom_column_srid,
      gcol: geom_column
    }, CDB_XYZ_Extent(coord.x, coord.y, zoom));

    sql(query, function (err, data) {
      if (err) {
        console.log("Error running torque query " + query + ": " + err);
        if ( err.message ) err.message = "TorqueRenderer: " + err.message;
        callback(err);
      }
      else callback(null, data.rows);
      //prof_fetch_time.end();
    });
  }
};

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
      callback(new Error("torque renderer only supports a single layer"))
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

module.exports = TorqueFactory;

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

function sql(dbParams, sqlClass) {
  // TODO: cache class instances by dbParams/sqlClass
  return function(query, callback) {
    var pg;
    try {
//console.log("Running query " + query + " with params "); console.dir(dbParams);
      pg = new sqlClass(dbParams);
      pg.query(query, callback, true); // ensure read-only transaction
    } catch (err) {
      callback(err);
    }
  };
}

function format(str) {
  for(var i = 1; i < arguments.length; ++i) {
    var attrs = arguments[i];
    for(var attr in attrs) {
      str = str.replace(RegExp('\\{' + attr + '\\}', 'g'), attrs[attr]);
    }
  }
  return str;
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
    var step = (data.max_date - data.min_date)/Math.min(attrs.steps, data.num_steps>>0);
    callback(null, {
      start: data.min_date,
      end: data.max_date,
      step: step || 1,
      data_steps: data.num_steps >> 0,
      is_time: is_time
    });
  });
}

