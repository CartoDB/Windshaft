var _      = require('underscore')
    , Step   = require('step')
    , pg     = require('pg');//.native; // disabled for now due to: https://github.com/brianc/node-postgres/issues/48
_.mixin(require('underscore.string'));

var global_settings = global.settings || {};
// Max database connections in the pool
// Subsequent connections will block waiting for a free slot
pg.defaults.poolSize = global_settings.db_pool_size || 16;

// Milliseconds of idle time before removing connection from pool
pg.defaults.poolIdleTimeout = global_settings.db_pool_idleTimeout || 30000;

// Frequency to check for idle clients within the pool, ms
pg.defaults.reapIntervalMillis = global_settings.db_pool_reapInterval || 1000;

pg.on('error', function(err, client) {
  console.log("PostgreSQL connection error: " + err);
});

// Workaround for https://github.com/Vizzuality/CartoDB-SQL-API/issues/100
var types = pg.types;
var arrayParser = require(__dirname + '/../../node_modules/pg/lib/types/arrayParser');
var floatParser = function(val) {
  return parseFloat(val);
};
var floatArrayParser = function(val) {
  if(!val) { return null; }
  var p = arrayParser.create(val, function(entry) {
    return floatParser(entry);
  });
  return p.parse();
};
types.setTypeParser(20, floatParser); // int8
types.setTypeParser(700, floatParser); // float4
types.setTypeParser(701, floatParser); // float8
types.setTypeParser(1700, floatParser); // numeric
types.setTypeParser(1021, floatArrayParser); // _float4
types.setTypeParser(1022, floatArrayParser); // _float8
types.setTypeParser(1231, floatArrayParser); // _numeric
types.setTypeParser(1016, floatArrayParser); // _int8

// Standard type->name mappnig (up to oid=2000)
var stdTypeName = {
    16: 'bool',
    17: 'bytea',
    20: 'int8',
    21: 'int2',
    23: 'int4',
    25: 'text',
    26: 'oid',
   114: 'JSON',
   700: 'float4',
   701: 'float8',
  1000: '_bool',
  1015: '_varchar',
  1042: 'bpchar',
  1043: 'varchar',
  1005: '_int2',
  1007: '_int4',
  1014: '_bpchar',
  1016: '_int8',
  1021: '_float4',
  1022: '_float8',
  1008: '_regproc',
  1009: '_text',
  1082: 'date',
  1114: 'timestamp',
  1182: '_date',
  1184: 'timestampz',
  1186: 'interval',
  1231: '_numeric',
  1700: 'numeric'
};

// Holds a typeId->typeName mapping for each
// database ever connected to
var extTypeName = {};

// PSQL
//
// A simple postgres wrapper with logic about username and database to connect
//
// * intended for use with pg_bouncer
// * defaults to connecting with a "READ ONLY" user to given DB if not passed a specific user_id
//
// @param opts connection options:
//    user: database username
//    pass: database user password
//    host: database host
//    port: database port
//    dbname: database name
//
var PSQL = function(dbopts) {

    var error_text = "Incorrect access parameters. If you are accessing via OAuth, please check your tokens are correct. For public users, please ensure your table is published."
    if ( ! dbopts || ( !_.isString(dbopts.user) && !_.isString(dbopts.dbname)))
    {
      // console.log("DBOPTS: "); console.dir(dbopts);
      throw new Error(error_text);
    }

    var me = {
        dbopts: dbopts
    };

    me.username = function(){
        return this.dbopts.user;
    };

    me.password = function(){
        return this.dbopts.pass;
    };

    me.database = function(){
        return this.dbopts.dbname;
    };

    me.dbhost = function(){
        return this.dbopts.host;
    };

    me.dbport = function(){
        return this.dbopts.port;
    };

    me.conString = "tcp://";
    if ( me.username() ) me.conString += me.username();
    me.conString += ":";
    if ( me.password() ) me.conString += me.password();
    me.conString += "@";
    if ( me.dbhost() ) me.conString += me.dbhost();
    if ( me.dbport() ) me.conString += ":" + me.dbport();
    me.conString += "/" + me.database();

    me.dbkey = function(){
      return this.database(); // + ":" + this.dbhost() + ":" + me.dbport();
    };

    me.ensureTypeCache = function(cb) {
      var db = this.dbkey();
      if ( extTypeName[db] ) { cb(); return; }
      this.dbConnect(this.conString, function(err, client, done) {
        if ( err ) { cb(err); return; }
        var types = ["'geometry'","'raster'"]; // types of interest
        client.query("SELECT oid, typname FROM pg_type where typname in (" + types.join(',') + ")", function(err,res) {
          done();
          if ( err ) { cb(err); return; }
          var cache = {};
          res.rows.map(function(r) {
            cache[r.oid] = r.typname;
          });
          extTypeName[db] = cache;
          cb();
        });
      });
    }

    // Return type name for a type identifier
    //
    // Possibly returns undefined, for unkonwn (uncached)
    //
    me.typeName = function(typeId) {
      return stdTypeName[typeId] ? stdTypeName[typeId] : extTypeName[this.dbkey()][typeId];
    }

    me.dbConnect = function(conString, cb) {
      pg.connect(conString, function(err, client, done) {
        if ( err ) {
          console.log("PostgreSQL connection error: " + err + " -- connection string: " + conString);
          err = new Error("cannot connect to the database");
          err.http_status = 500; // connection errors are internal
        }
        cb(err, client, done);
      });
    };

    me.connect = function(cb){
      var that = this;
      this.ensureTypeCache(function(err) {
        if ( err ) cb(err);
        else that.dbConnect(that.conString, cb);
      });
    };

    me.eventedQuery = function(sql, callback){
        var that = this;

        Step(
            function(){
                that.sanitize(sql, this);
            },
            function(err, clean){
                if (err) throw err;
                that.connect(this);
            },
            function(err, client, done){
                if (err) throw err;
                var query = client.query(sql);

                // forward notices to query
                var noticeListener = function() {
                  query.emit('notice', arguments); 
                };
                client.on('notice', noticeListener);

                // NOTE: for some obscure reason passing "done" directly
                //       as the listener works but can be slower
                //      (by x2 factor!)
                query.on('end', function() {
                  client.removeListener('notice', noticeListener);
                  done();
                }); 
                return query;
            },
            function(err, query){
                callback(err, query)
            }
        );
    };

    me.quoteIdentifier = function(str) {
      return pg.Client.prototype.escapeIdentifier(str);
    };

    me.escapeLiteral = function(s) {
      return pg.Client.prototype.escapeLiteral(str);
    };

    me.query = function(sql, callback, readonly){
        var that = this;
        var finish;

        Step(
            function(){
                that.sanitize(sql, this);
            },
            function(err, clean){
                if (err) throw err;
                that.connect(this);
            },
            function(err, client, done){
                if (err) throw err;
                finish = done;
                if ( readonly ) sql = 'SET TRANSACTION READ ONLY; ' + sql;
                client.query(sql, this);
            },
            function(err, res){

                // Release client to the pool
                // should this be postponed to after the callback ?
                // NOTE: if we pass a true value to finish() the client
                //       will be removed from the pool.
                //       We don't want this. Not now.
                if ( finish ) finish();

                callback(err, res)
            }
        );
    };

    // throw exception if illegal operations are detected
    // NOTE: this check is weak hack, better database
    //       permissions should be used instead.
    me.sanitize = function(sql, callback){
        // NOTE: illegal table access is checked in main app
        if (sql.match(/^\s+set\s+/i)){
            var error = new SyntaxError("SET command is forbidden");
            error.http_status = 403;
            callback(error); 
            return;
        }
        callback(null,true);
    };

    return me;
};

// little hack for UI
//
// TODO:drop, fix in the UI (it's not documented in doc/API)
//
PSQL.window_sql = function(sql, limit, offset) {
  // only window select functions (NOTE: "values" will be broken, "with" will be broken)
  if (!_.isNumber(limit) || !_.isNumber(offset) ) return sql;

  var cte = '';

  if ( sql.match(/^\s*WITH\s/i) ) {

    var rem = sql; // analyzed portion of sql
    var q; // quote char
    var n = 0; // nested parens level
    var s = 0; // 0:outQuote, 1:inQuote
    var l;
    while (1) {
      l = rem.search(/[("')]/);
//console.log("REM Is " + rem);
      if ( l < 0 ) {
        console.log("Malformed SQL");
        return sql;
      }
      var f = rem.charAt(l);
//console.log("n:" + n + " s:" + s + " l:" + l + " charAt(l):" + f + " charAt(l+1):" + rem.charAt(l+1));
      if ( s == 0 ) {
        if ( f == '(' ) ++n; 
        else if ( f == ')' ) {
          if ( ! --n ) { // end of CTE
            cte += rem.substr(0, l+1);
            rem = rem.substr(l+1);
  //console.log("Out of cte, rem is " + rem);
            if ( rem.search(/^s*,/) < 0 ) break;
            else continue; // cte and rem already updated
          }
        }
        else { // enter quoting
          s = 1; q = f;
        }
      }
      else if ( f == q ) {
        if ( rem.charAt(l+1) == f ) ++l; // escaped
        else s = 0; // exit quoting
      }
      cte += rem.substr(0, l+1);
      rem = rem.substr(l+1);
    }
/*
console.log("cte: " + cte);
console.log("rem: " + rem);
*/
    sql = rem; //sql.substr(l+1);
  }


  var re_SELECT = RegExp(/^\s*SELECT\s/i);
  var re_INTO = RegExp(/\sINTO\s+([^\s]+|"([^"]|"")*")\s*$/i);

  //console.log("SQL " + sql);
  //console.log(" does " + ( sql.match(re_SELECT) ? '' : 'not ' ) + "match re_SELECT " + re_SELECT);
  //console.log(" does " + ( sql.match(re_INTO) ? '' : 'not ' ) + "match re_INTO " + re_INTO);

  if (
         sql.match(re_SELECT) &&
       ! sql.match(re_INTO)
     )
  {
      return cte + "SELECT * FROM (" + sql + ") AS cdbq_1 LIMIT " + limit + " OFFSET " + offset;
  } 

  return cte + sql;
}

module.exports = PSQL;
