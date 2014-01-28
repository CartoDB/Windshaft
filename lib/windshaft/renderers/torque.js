var carto = require('carto');
var _ = require('underscore');
var PSQL = require('./psql');
var Step = require('step');
var torque_reference = require('torque.js').cartocss_reference;


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
  var checks = ['steps', 'resolution', 'column'];
  var attrs = attrsFromCartoCSS(cartoCSS, checks);
  return attrs;
}

function Renderer(mapConfig, sql, attrs) {
  this.mapConfig = mapConfig;
  this.sql = sql;
  this.attrs = attrs;
  var layer = _.find(mapConfig.layers, function(l) {
    return l.type === 'torque';
  });
  this.layer_sql = layer.options.sql;
}

Renderer.prototype = {
  /// API: renders a tile with the Renderer configuration
  /// @param x tile x coordinate
  /// @param y tile y coordinate
  /// @param z tile zoom 
  /// callback: will be called when done using nodejs protocol (err, data)
  getTile: function(x, y, z, callback) {
    _getTileData(this.sql, {x: x, y: y}, z, this.attrs, this.layer_sql, callback);
  }
};

/// API: initializes the renderer, it should be called once
/// @param options initialization options
//      - sqlClass: class used to access postgres, by default is PSQL
function TorqueFactory(options) {
    this.options = options || {};
    _.defaults(this.options, {
      sqlClass: this.PSQL
    });
    if (this.options.sqlClass) {
      this.sqlClass = options.sqlClass;
    }
}

TorqueFactory.prototype = {
  /// API: renderer name, use for information pourposes
  name: 'torque',

  /// API: tile formats this module is able to render
  supported_formats: ['json.torque', 'bin.torque'],

  /// API: creates a renderer
  /// @param mapConfig json object with full mapConfig
  /// @param dbParams json object with database connection params (host, dbname, user and pass)
  /// @param format one of the supported_formats
  /// @param layer layer index inside mapConfig (optional)
  /// @param callback function(err, renderer) called when method finishes
  getRenderer: function(mapConfig, dbParams, format, layer, callback) {
    if (callback === undefined) callback = layer;
    if(!_.contains(this.supported_formats, format)) {
      callback(new Error("format not supported: " + format));
      return;
    }
    var pgSQL = sql(dbParams, this.sqlClass);
    fetchMapConfigAttributes(pgSQL, mapConfig, dbParams, layer, function(err, params){
      if (err) {
        callback(err);
        return;
      }
      callback(null, new Renderer(mapConfig, pgSQL, params, layer));
    });
  }

};

module.exports = TorqueFactory;

// returns an array of errors if the mapconfig is not supported or contains errors
// errors is empty is the configuration is ok
// dbParams: host, dbname, user and pass 
// layer: optional, if is specified only a layer is checked
function fetchMapConfigAttributes(sql, mapConfig, dbParams, layer_id, callback) {

  if (callback === undefined) callback = layer_id;

  // only one layer supported
  var layer = _.find(mapConfig.layers, function(l) {
    return l.type === 'torque';
  });

  if (!layer) {
    callback(new Error("mapconfig does not contain any torque layer"));
    return;
  }

  // check attrs
  try { var attrs = _checkLayerAttributes(layer); } 
  catch (e) { callback(e); return; }

  // fetch layer attributes to check the query and so on is ok
  var layer_sql = layer.options.sql;
  fetchLayerAttributes(sql, layer_sql, attrs, callback);
}

function sql(dbParams, sqlClass) {
  return function(query, callback) {
    var pg = new sqlClass(dbParams);
    pg.query(query, callback);
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
      console.log("ERROR: layer query '" + layer_query + "' returned no data");
      throw new Error("Layer query returned no data");
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
        "st_xmax(st_envelope(st_collect(the_geom))) xmax, " +
        "st_ymax(st_envelope(st_collect(the_geom))) ymax, " +
        "st_xmin(st_envelope(st_collect(the_geom))) xmin, " +
        "st_ymin(st_envelope(st_collect(the_geom))) ymin, " +
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
      callback(err);
      return;
    }
    data = data.rows[0];
    callback(null, {
      start: data.min_date,
      end: data.max_date,
      step: (data.max_date - data.min_date)/Math.min(attrs.steps, data.num_steps>>0),
      data_steps: data.num_steps >> 0,
      is_time: is_time,
      bounds: [
        [data.ymin, data.xmin],
        [data.ymax, data.xmax]
      ]
    });
  });
}


function _getTileData(sql, coord, zoom, layer_sql, attrs, callback) {
    //var prof_fetch_time = Profiler.metric('ProviderJSON:tile_fetch_time').start()
    

    var column_conv = attrs.column;

    if(attrs.is_time) {
      column_conv = format("date_part('epoch', {column})", attrs);
    }

    var tile_sql = "" +
      "WITH " +
      "par AS (" +
      "  SELECT CDB_XYZ_Resolution({zoom})*{resolution} as res" +
      ",  256/{resolution} as tile_size" +
      ", CDB_XYZ_Extent({x}, {y}, {zoom}) as ext "  +
      ")," +
      "cte AS ( "+
      "  SELECT ST_SnapToGrid(i.the_geom_webmercator, p.res) g" +
      ", {countby} c" +
      ", floor(({column_conv} - {start})/{step}) d" +
      "  FROM ({_sql}) i, par p " +
      "  WHERE i.the_geom_webmercator && p.ext " +
      "  GROUP BY g, d" +
      ") " +
      "" +
      "SELECT (st_x(g)-st_xmin(p.ext))/p.res x__uint8, " +
      "       (st_y(g)-st_ymin(p.ext))/p.res y__uint8," +
      " array_agg(c) vals__uint8," +
      " array_agg(d) dates__uint16" +
      // the tile_size where are needed because the overlaps query in cte subquery includes the points
      // in the left and bottom borders of the tile
      " FROM cte, par p where (st_y(g)-st_ymin(p.ext))/p.res < tile_size and (st_x(g)-st_xmin(p.ext))/p.res < tile_size GROUP BY x__uint8, y__uint8";


    var query = format(tile_sql, this.options, {
      zoom: zoom,
      x: coord.x,
      y: coord.y,
      column_conv: column_conv,
      _sql: layer_sql
    });

    sql(query, function (err, data) {
      if (err) {
        callback({ error: 'problem fetching data' });
      } else {
        callback(null, data.rows);
      }
      //prof_fetch_time.end();
    });
}
