// FLUSHALL Redis before starting
require('../support/test_helper');

var assert = require('../support/assert');
var _ = require('underscore');
var querystring = require('querystring');
var fs = require('fs');
var redis = require('redis');
var step = require('step');
var mapnik = require('mapnik');
var Windshaft = require('../../lib/windshaft');
var ServerOptions = require('../support/server_options');
var semver = require('semver');
var http = require('http');
var testClient = require('../support/test_client');

function rmdir_recursive_sync(dirname) {
  var files = fs.readdirSync(dirname);
  for (var i=0; i<files.length; ++i) {
    var f = dirname + "/" + files[i];
    var s = fs.lstatSync(f);
    if ( s.isFile() ) {
      fs.unlinkSync(f);
    }
    else {
        rmdir_recursive_sync(f);
    }
  }
}

suite('server_gettile', function() {

    ////////////////////////////////////////////////////////////////////
    //
    // SETUP
    //
    ////////////////////////////////////////////////////////////////////

    var server = new Windshaft.Server(ServerOptions);
    server.setMaxListeners(0);
    var redis_client = redis.createClient(ServerOptions.redis.port);
    var res_serv; // resources server
    var res_serv_status = { numrequests:0 }; // status of resources server
    var res_serv_port = 8033; // FIXME: make configurable ?

    var IMAGE_EQUALS_TOLERANCE_PER_MIL = 25;

    suiteSetup(function(done) {

      // Check that we start with an empty redis db
      redis_client.keys("*", function(err, matches) {

        if ( err ) { done(err); return; }

        assert.equal(matches.length, 0,
          "redis keys present at setup time on port " +
          ServerOptions.redis.port + ":\n" + matches.join("\n"));

        // Start a server to test external resources
        res_serv = http.createServer( function(request, response) {
            ++res_serv_status.numrequests;
            var filename = __dirname + '/../fixtures/markers' + request.url;
            fs.readFile(filename, "binary", function(err, file) {
              if ( err ) {
                response.writeHead(404, {'Content-Type': 'text/plain'});
                response.write("404 Not Found\n");
              } else {
                response.writeHead(200);
                response.write(file, "binary");
              }
              response.end();
            });
        });
        res_serv.listen(res_serv_port, done);

      });

    });

    function imageCompareFn(fixture, done) {
        return function(err, res) {
            if (err) {
                return done(err);
            }
            assert.imageEqualsFile(res.body, './test/fixtures/' + fixture, IMAGE_EQUALS_TOLERANCE_PER_MIL, done);
        };
    }


    ////////////////////////////////////////////////////////////////////
    //
    // GET TILE
    // --{
    ////////////////////////////////////////////////////////////////////

    test("get'ing a tile with default style should return an expected tile", function(done){
      testClient.getTile(testClient.defaultTableMapConfig('test_table'), 13, 4011, 3088,
          imageCompareFn('test_table_13_4011_3088.png', done)
      );
    });

    test.skip("response of get tile can be served by renderer cache",  function(done){
      var cb = Date.now();
      step(
        function get1 () {
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/table/test_table/13/4011/3088.png?cache_buster=' + cb,
              method: 'GET',
              encoding: 'binary'
          },{}, function(res, err) { next(err, res); });
        },
        function check1(err, res) {
          if ( err ) {
              throw err;
          }
          assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
          var xwc = res.headers['x-windshaft-cache'];
          assert.ok(!xwc);
          return null;
        },
        function get2() {
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/table/test_table/13/4011/3088.png?cache_buster=' + cb,
              method: 'GET',
              encoding: 'binary'
          },{}, function(res, err) { next(err, res); });
        },
        function check2(err, res) {
          if ( err ) {
              throw err;
          }
          assert.equal(res.statusCode, 200);
          var xwc = res.headers['x-windshaft-cache'];
          assert.ok(xwc);
          assert.ok(xwc > 0);
          return null;
        },
        function get3() {
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/table/test_table/13/4011/3088.png',
              method: 'GET',
              encoding: 'binary'
          },{}, function(res, err) { next(err, res); });
        },
        function check3(err, res) {
          if ( err ) {
              throw err;
          }
          assert.equal(res.statusCode, 200);
          var xwc = res.headers['x-windshaft-cache'];
          assert.ok(xwc);
          assert.ok(xwc > 0);
          return null;
        },
        function get4() {
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/table/test_table/13/4011/3088.png?cache_buster='+(cb+1),
              method: 'GET',
              encoding: 'binary'
          },{}, function(res, err) { next(err, res); });
        },
        function check4(err, res) {
          if ( err ) {
              throw err;
          }
          assert.equal(res.statusCode, 200);
          var xwc = res.headers['x-windshaft-cache'];
          assert.ok(!xwc);
          return null;
        },
        function finish(err) {
          done(err);
        }
      );
    });

    test("should not choke when queries end with a semicolon",  function(done){
        testClient.getTile(testClient.singleLayerMapConfig('SELECT * FROM test_table limit 2;'), 0, 0, 0, done);
    });

    test("should not choke when sql ends with a semicolon and some blanks",  function(done){
        testClient.getTile(testClient.singleLayerMapConfig('SELECT * FROM test_table limit 2; \t\n'), 0, 0, 0, done);
    });

    test("should not strip quoted semicolons within an sql query",  function(done){
        testClient.getTile(
            testClient.singleLayerMapConfig("SELECT * FROM test_table where name != ';\n'"), 0, 0, 0, done
        );
    });

    test.skip("get'ing two tiles with same configuration uses renderer cache",  function(done){
        // NOTE: mus tuse the same cache_buster
        var style = querystring.stringify({style: "#test_table{marker-fill: blue;marker-line-color: black;}"});
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/13/4011/3088.png?cache_buster=5&' + style,
            method: 'GET',
            encoding: 'binary'
        },{}, function(res){
            assert.ok(!res.headers.hasOwnProperty('x-windshaft-cache'),
                     "Did hit renderer cache on first time");
            assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_styled.png', IMAGE_EQUALS_TOLERANCE_PER_MIL, function(err) {
                if (err) { done(err); return; }
                assert.response(server, {
                    url: '/database/windshaft_test/table/test_table/13/4011/3087.png?cache_buster=5&' + style,
                    method: 'GET',
                    encoding: 'binary'
                }, {},
                function(res){
                  assert.ok(res.headers.hasOwnProperty('x-windshaft-cache'),
                     "Did not hit renderer cache on second time");
                  done();
                });
             });
        });
    });

    var test_style_black_200 = "#test_table{marker-fill:black;marker-line-color:black;marker-width:5}";
    var test_style_black_210 = "#test_table{marker-fill:black;marker-line-color:black;marker-width:10}";

    test("get'ing a tile with url specified 2.0.0 style should return an expected tile",  function(done){
        testClient.getTile(testClient.defaultTableMapConfig('test_table', test_style_black_200, '2.0.0'),
            13, 4011, 3088, imageCompareFn('test_table_13_4011_3088_styled_black.png', done));
    });

    test("get'ing a tile with url specified 2.1.0 style should return an expected tile",  function(done){
        testClient.getTile(testClient.defaultTableMapConfig('test_table', test_style_black_210, '2.1.0'),
            13, 4011, 3088, imageCompareFn('test_table_13_4011_3088_styled_black.png', done));
    });

    // See http://github.com/CartoDB/Windshaft/issues/99
    test("unused directives are tolerated",  function(done){
        var style = "#test_table{point-transform: 'scale(100)';}";
        var sql = "SELECT 1 as cartodb_id, 'SRID=4326;POINT(0 0)'::geometry as the_geom";
        testClient.getTile(testClient.singleLayerMapConfig(sql, style), 0, 0, 0,
            imageCompareFn('test_default_mapnik_point.png', done));
    });

    // See http://github.com/CartoDB/Windshaft/issues/100
    var test_strictness = function(done){
        var style = querystring.stringify({
          style: "#test_table{point-transform: 'scale(100)';}",
          sql: "SELECT 1 as cartodb_id, 'SRID=3857;POINT(666 666)'::geometry as the_geom"
        });
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/0/0/0.png?strict=1&' + style,
            method: 'GET',
            encoding: 'binary'
        },{}, function(res){
            assert.equal(res.statusCode, 400);
            done();
        });
    };
    var test_strict_lbl = "unused directives are not tolerated if strict";
    if ( semver.satisfies(mapnik.versions.mapnik, '2.3.x') ) {
      // Strictness handling changed in 2.3.x, possibly a bug:
      // see http://github.com/mapnik/mapnik/issues/2301
      console.warn("Strictness test skipped due to http://github.com/mapnik/mapnik/issues/2301");
      test.skip(test_strict_lbl,  test_strictness);
    }
    else {
      test.skip(test_strict_lbl,  test_strictness);
    }

    test("beforeTileRender is called when the client request a tile",  function(done) {
        testClient.getTile(testClient.defaultTableMapConfig('test_table'), 6, 31, 24, function(err, res) {
            assert.equal(res.headers['x-beforetilerender'], 'called');
            done();
        });
    });

    test("afterTileRender is called when the client request a tile",  function(done) {
        testClient.getTile(testClient.defaultTableMapConfig('test_table'), 6, 31, 24, function(err, res) {
            assert.equal(res.headers['x-aftertilerender'], 'called');
            assert.equal(res.headers['x-aftertilerender2'], 'called');
            done();
        });
    });

    // Test for https://github.com/Vizzuality/Windshaft/issues/65
    test.skip("catching non-Error exception doesn't kill the backend", function(done) {

      assert.response(server, {
          url: '/database/windshaft_test/table/test_table/0/0/0.png?testUnexpectedError=1',
          method: 'GET'
      },{}, function(res) {
        assert.equal(res.statusCode, 400); // , res.body);
        assert.deepEqual(JSON.parse(res.body),  {"error":"test unexpected error"});
        done();
      });

    });

    // Test that you cannot write to the database from a tile request
    //
    // See http://github.com/CartoDB/Windshaft/issues/130
    // Needs a fix on the mapnik side:
    // https://github.com/mapnik/mapnik/pull/2143
    //
    // TODO: enable based on Mapnik version ?
    //
    test.skip("database access is read-only", function(done) {

      step(
        function doGet() {
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/table/test_table/0/0/0.png?sql=select+st_point(0,0)+as+the_geom,*+from+test_table_inserter(st_setsrid(st_point(0,0),4326),\'write\')',
              method: 'GET'
          }, {}, function(res, err) { next(err, res); });
        },
        function check(err, res) {
          if ( err ) {
              throw err;
          }
          assert.equal(res.statusCode, 400, res.statusCode + ': ' + ( res.statusCode !== 200 ? res.body : '..' ));
          var parsed = JSON.parse(res.body);
          assert.ok(parsed.error);
          var msg = parsed.error;
          assert.ok(msg.match(/read-only transaction/), msg);
          return null;
        },
        function finish(err) {
          assert.response(server, {
              url: '/database/windshaft_test/table/test_table/style',
              method: 'DELETE' },{}, function() { done(err); });
        }
      );

    });

    // See https://github.com/CartoDB/Windshaft/issues/167
    test.skip("does not die on unexistent statsd host",  function(done) {
      step(
        function change_config() {
          var CustomOptions = _.clone(ServerOptions);
          CustomOptions.statsd = _.clone(CustomOptions.statsd);
          CustomOptions.statsd.host = 'whoami.vizzuality.com';
          CustomOptions.statsd.cacheDns = false;
          server = new Windshaft.Server(CustomOptions);
          server.setMaxListeners(0);
          return null;
        },
        function do_get(err) {
          if ( err ) {
              throw err;
          }
          var next = this;
          var errors = [];
          // We need multiple requests to make sure
          // statsd_client eventually tries to send
          // stats _and_ DNS lookup is given enough
          // time (an interval is used later for that)
          var numreq = 10;
          var pending = numreq;
          var completed = function(err) {
            if ( err ) {
                errors.push(err);
            }
            if ( ! --pending ) {
              setTimeout(function() {
              next(errors.length ? new Error(errors.join(',')) : null);
              }, 10);
              return;
            }
          };
          for (var i=0; i<numreq; ++i) {
            assert.response(server, {
                url: '/database/windshaft_test/table/test_table/6/31/24.png',
                method: 'GET'
            },{}, function(res, err) { completed(err); });
          }
        },
        function do_check(err) {
          if ( err ) {
              throw err;
          }
          // being alive is enough !
          return null;
        },
        function finish(err) {
          // reset server
          server = new Windshaft.Server(ServerOptions);
          done(err);
        }
      );
    });

    // See https://github.com/CartoDB/Windshaft/issues/173
    test.skip("does not send db details in connection error response",  function(done) {
      var base_key = 'map_style|windshaft_test|test_table';
      step(
        function change_config() {
          var CustomOptions = _.clone(ServerOptions);
          CustomOptions.grainstore = _.clone(CustomOptions.grainstore);
          CustomOptions.grainstore.datasource = _.clone(CustomOptions.grainstore.datasource);
          CustomOptions.grainstore.datasource.port = '666';
          server = new Windshaft.Server(CustomOptions);
          server.setMaxListeners(0);
          return null;
        },
        function do_get(err) {
          if ( err ) {
              throw err;
          }
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/table/test_table/6/31/24.png',
              method: 'GET'
          },{}, function(res, err) { next(err, res); });
        },
        function do_check(err, res) {
          if ( err ) {
              throw err;
          }
          // TODO: should be 500 !
          assert.equal(res.statusCode, 400);
          var parsed = JSON.parse(res.body);
          assert.ok(parsed.error);
          var msg = parsed.error;
          assert.ok(msg.match(/connect/), msg);
          assert.ok(!msg.match(/666/), msg);
          return null;
        },
        function finish(err) {
          // reset server
          server = new Windshaft.Server(ServerOptions);
          redis_client.del(base_key, function(e) {
            if ( e ) {
                console.error(e);
            }
            done(err);
          });
        }
      );
    });

    test('high cpu regression with mapnik <2.3.x', function(done) {
        var sql = [
            "SELECT 'my polygon name here' AS name,",
            "       st_envelope(st_buffer(st_transform(st_setsrid(st_makepoint(-26.6592894004,49.7990296995),4326),3857),10000000)) AS the_geom",
            "FROM generate_series(-6,6) x",
            "UNION ALL",
            "SELECT 'my marker name here' AS name,",
            "       st_transform(st_setsrid(st_makepoint(49.6042060319,-49.0522997372),4326),3857) AS the_geom",
            "FROM generate_series(-6,6) x"
        ].join(' ');

        var style = [
            '#test_table {marker-fill:#ff7;',
            '    marker-max-error:0.447492761618;',
            '    marker-line-opacity:0.659371340628;',
            '    marker-allow-overlap:true;',
            '    polygon-fill:green;',
            '    marker-spacing:0.0;',
            '    marker-width:4.0;',
            '    marker-height:18.0;',
            '    marker-opacity:0.942312062822;',
            '    line-color:green;',
            '    line-gamma:0.945973211092;',
            '    line-cap:square;',
            '    polygon-opacity:0.12576055992;',
            '    marker-type:arrow;',
            '    polygon-gamma:0.46354913107;',
            '    line-dasharray:33,23;',
            '    line-join:bevel;',
            '    marker-placement:line;',
            '    line-width:1.0;',
            '    marker-line-color:#ff7;',
            '    line-opacity:0.39403752154;',
            '    marker-line-width:3.0;',
            '}'
        ].join('');

        testClient.getTile(testClient.singleLayerMapConfig(sql, style), 13, 4011, 3088, done);
    });

    ////////////////////////////////////////////////////////////////////
    //
    // --}
    // TEARDOWN
    //
    ////////////////////////////////////////////////////////////////////

    suiteTeardown(function(done) {

      // Close the resources server
      res_serv.close();

      var errors = [];

      // Check that we left the redis db empty
      redis_client.keys("*", function(err, matches) {
          if ( err ) {
              errors.push(err);
          }
          try {
            assert.equal(matches.length, 0, "Left over redis keys:\n" + matches.join("\n"));
          } catch (err) {
            errors.push(err);
          }

          var cachedir = global.environment.millstone.cache_basedir;
          rmdir_recursive_sync(cachedir);

          redis_client.flushall(function() {
            done(errors.length ? new Error(errors) : null);
          });
      });

    });
});

