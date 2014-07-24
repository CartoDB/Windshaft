// FLUSHALL Redis before starting

var   assert        = require('../support/assert')
    , tests         = module.exports = {}
    , _             = require('underscore')
    , querystring   = require('querystring')
    , fs            = require('fs')
    , redis         = require('redis')
    , th            = require('../support/test_helper')
    , Step          = require('step')
    , mapnik        = require('mapnik')
    , Windshaft     = require('../../lib/windshaft')
    , ServerOptions = require('../support/server_options')
    , semver        = require('semver')
    , http          = require('http');

function rmdir_recursive_sync(dirname) {
  var files = fs.readdirSync(dirname);
  for (var i=0; i<files.length; ++i) {
    var f = dirname + "/" + files[i];
    var s = fs.lstatSync(f);
    if ( s.isFile() ) {
      console.log("Unlinking " + f);
      fs.unlinkSync(f)
    }
    else rmdir_recursive_sync(f);
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
                console.log("File '" + filename + "' not found");
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


    ////////////////////////////////////////////////////////////////////
    //
    // GET TILE
    // --{
    ////////////////////////////////////////////////////////////////////

    test("get'ing a tile with default style should return an expected tile", 
    function(done){
      Step (
        function makeGet() {
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/table/test_table/13/4011/3088.png32',
              method: 'GET',
              encoding: 'binary'
          },{}, function(res) { next(null,res); });
        },
        function checkResponse(err, res) {
          assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
          assert.equal(res.headers['content-type'], "image/png");
          assert.imageEqualsFile(res.body,
            './test/fixtures/test_table_13_4011_3088.png',
            IMAGE_EQUALS_TOLERANCE_PER_MIL, this);
        },
        function finish(err) {
          assert.response(server, {
              url: '/database/windshaft_test/table/test_table/style',
              method: 'DELETE' },{}, function(res) { done(err); });
        }
      );
    });

    test("response of get tile can be served by renderer cache",  function(done){
      var cb = Date.now();
      Step(
        function get1 () {
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/table/test_table/13/4011/3088.png?cache_buster=' + cb,
              method: 'GET',
              encoding: 'binary'
          },{}, function(res, err) { next(err, res); });
        },
        function check1(err, res) {
          if ( err ) throw err;
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
          if ( err ) throw err;
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
          if ( err ) throw err;
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
          if ( err ) throw err;
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

    test("get'ing a tile with default style and sql should return a constrained tile",  function(done){
        var sql = querystring.stringify({sql: "SELECT * FROM test_table limit 2"});
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/13/4011/3088.png?' + sql,
            method: 'GET',
            encoding: 'binary'
        },{
            status: 200,
            headers: { 'Content-Type': 'image/png' }
        }, function(res){
            assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_limit_2.png', IMAGE_EQUALS_TOLERANCE_PER_MIL, function(err) {
                if (err) throw err;
                assert.deepEqual(res.headers['content-type'], "image/png");
                done();
            });
        });
    });

    test("should not choke when queries end with a semicolon",  function(done){
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/0/0/0.png?'
              + querystring.stringify({sql: "SELECT * FROM test_table limit 2;"}),
            method: 'GET',
        },{
            status: 200,
            headers: { 'Content-Type': 'image/png' }
        }, function(res){
            done();
        });
    });

    test("should not choke when sql ends with a semicolon and some blanks",  function(done){
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/0/0/0.png?'
              + querystring.stringify({sql: "SELECT * FROM test_table limit 2; \t\n"}),
            method: 'GET',
        },{
            status: 200,
            headers: { 'Content-Type': 'image/png' }
        }, function(res){
            done();
        });
    });

    test("should not strip quoted semicolons within an sql query",  function(done){
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/0/0/0.png?'
              + querystring.stringify({sql: "SELECT * FROM test_table where name != ';\n'"}),
            method: 'GET',
        },{
            status: 200,
            headers: { 'Content-Type': 'image/png' }
        }, function(res){
            done();
        });
    });

    test("get'ing a tile with default style and bogus sql should return 400 status",  function(done){
        var sql = querystring.stringify({sql: "BOGUS FROM test_table"});
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/13/4011/3088.png?' + sql,
            method: 'GET',
            encoding: 'binary'
        },{}, function(res) {
            assert.equal(res.statusCode, 400, res.statusCode + ': ' + res.body);
            var body_parsed = JSON.parse(res.body);
            assert.ok(/syntax error/.test(body_parsed.error), "Unexpected error: " + body_parsed.error);
            done();
        });
    });

    test("get tile jsonp error is returned with 200 status",  function(done){
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/13/4011/3088.png?sql=bogus&callback=test',
            method: 'GET'
        },{}, function(res){
            assert.equal(res.statusCode, 200);
            assert.ok(res.body.match(/"error":/), 'missing error in response: ' + res.body);
            done();
        });
    });


    test("get'ing a tile from a query with no geometry field returns 400 status",  function(done){
        var sql = querystring.stringify({sql: "SELECT 1"});
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/13/4011/3088.png?' + sql,
            method: 'GET',
            encoding: 'binary'
        },{}, function(res) {
            assert.equal(res.statusCode, 400, res.statusCode + ': ' + res.body);
            var body_parsed = JSON.parse(res.body);
            assert.ok(/column.*does not exist/.test(body_parsed.error), "Unexpected error: " + body_parsed.error);
            done();
        });
    });

    test("get'ing a tile with url specified style should return an expected tile",  function(done){
        var style = querystring.stringify({style: "#test_table{marker-fill: blue;marker-line-color: black;}"});
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/13/4011/3088.png?' + style,
            method: 'GET',
            encoding: 'binary'
        },{
            status: 200,
            headers: { 'Content-Type': 'image/png' }
        }, function(res){
            assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_styled.png', IMAGE_EQUALS_TOLERANCE_PER_MIL, function(err) {
                if (err) throw err;
                done();
            });
        });
    });

    test("get'ing two tiles with same configuration uses renderer cache",  function(done){
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


    test("get'ing a tile with url specified style should return an expected tile twice",  function(done){
        var style = querystring.stringify({style: test_style_black_200});
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/13/4011/3088.png?' + style,
            method: 'GET',
            encoding: 'binary'
        },{}, function(res){
            assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
            assert.equal(res.headers['content-type'], "image/png");
            assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_styled_black.png', IMAGE_EQUALS_TOLERANCE_PER_MIL, function(err, similarity) {
                if (err) throw err;
                done();
            });
        });
    });

    test("get'ing a tile with url specified 2.0.0 style should return an expected tile",  function(done){
        var style = querystring.stringify({style: test_style_black_200, style_version: '2.0.0'});
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/13/4011/3088.png?' + style,
            method: 'GET',
            encoding: 'binary'
        },{}, function(res){
            assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
            assert.equal(res.headers['content-type'], "image/png");
            assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_styled_black.png', IMAGE_EQUALS_TOLERANCE_PER_MIL, function(err) {
                if (err) throw err;
                done();
            });
        });
    });

    test("get'ing a tile with url specified 2.1.0 style should return an expected tile",  function(done){
        var style = querystring.stringify({style: test_style_black_210, style_version: '2.1.0'});
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/13/4011/3088.png?' + style,
            method: 'GET',
            encoding: 'binary'
        },{
            status: 200,
            headers: { 'Content-Type': 'image/png' }
        }, function(res){
            assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_styled_black.png', IMAGE_EQUALS_TOLERANCE_PER_MIL, function(err) {
                if (err) throw err;
                done();
            });
        });
    });

    test("get'ing a tile with url specified bogus style should return 400 status",  function(done){
        var style = querystring.stringify({style: "#test_table{xxxxx;}"});
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/13/4011/3088.png?' + style,
            method: 'GET',
            encoding: 'binary'
        },{}, function(res) {
            assert.equal(res.statusCode, 400, res.statusCode + ': ' + res.body);
            done();
        });
    });

    test("dynamically set styles in same session and then back to default",  function(done){
        var style = querystring.stringify({style: "#test_table{marker-fill: black;marker-line-color: black;}"});
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/13/4011/3088.png?' + style,
            method: 'GET',
            encoding: 'binary'
        },{
            status: 200,
            headers: { 'Content-Type': 'image/png' }
        }, function(res){
            assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_styled_black.png', IMAGE_EQUALS_TOLERANCE_PER_MIL, function(err) {
                if (err) throw err;
                assert.deepEqual(res.headers['content-type'], "image/png");

                // second style
                var style = querystring.stringify({style: "#test_table{marker-fill: black;marker-line-color: black;}"});
                assert.response(server, {
                    url: '/database/windshaft_test/table/test_table/13/4011/3088.png?' + style,
                    method: 'GET',
                    encoding: 'binary'
                },{
                    status: 200,
                    headers: { 'Content-Type': 'image/png' }
                }, function(res){
                    assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_styled_black.png', IMAGE_EQUALS_TOLERANCE_PER_MIL, function(err) {
                        if (err) throw err;
                        assert.deepEqual(res.headers['content-type'], "image/png");

                        //back to default
                        assert.response(server, {
                            url: '/database/windshaft_test/table/test_table/13/4011/3088.png',
                            method: 'GET',
                            encoding: 'binary'
                        },{
                            status: 200,
                            headers: { 'Content-Type': 'image/png' }
                        }, function(res){
                            assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088.png', IMAGE_EQUALS_TOLERANCE_PER_MIL, function(err) {
                                if (err) throw err;
                                assert.deepEqual(res.headers['content-type'], "image/png");
                                done();
                            });
                    });
                    });
                });
            });
        });
    });

    test("get'ing a tile with CORS enabled should return CORS headers",  function(done){
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/6/31/24.png',
            method: 'GET'
        },{
            status: 200,
            headers: {
              'Access-Control-Allow-Headers': 'X-Requested-With, X-Prototype-Version, X-CSRF-Token',
              'Access-Control-Allow-Origin': '*'
            }
        }, function() { done(); });
    });

    // See http://github.com/CartoDB/Windshaft/issues/99
    test("unused directives are tolerated",  function(done){
        var style = querystring.stringify({
          style: "#test_table{point-transform: 'scale(100)';}",
          sql: "SELECT 1 as cartodb_id, 'SRID=4326;POINT(0 0)'::geometry as the_geom"
        });
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/0/0/0.png?' + style,
            method: 'GET',
            encoding: 'binary'
        },{}, function(res){
            assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
            assert.equal(res.headers['content-type'], "image/png");
            assert.imageEqualsFile(res.body, './test/fixtures/test_default_mapnik_point.png', IMAGE_EQUALS_TOLERANCE_PER_MIL, function(err) {
                if (err) throw err;
                done();
            });
        });
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
      test(test_strict_lbl,  test_strictness);
    }

    test("beforeTileRender is called when the client request a tile",  function(done) {
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/6/31/24.png',
            method: 'GET'
        },{
            status: 200,
            headers: {'X-BeforeTileRender': 'called'}
        }, function() { done(); });
    });

    test("afterTileRender is called when the client request a tile",  function(done) {
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/6/31/24.png',
            method: 'GET'
        },{
            status: 200,
            headers: {'X-AfterTileRender': 'called', 'X-AfterTileRender2': 'called'}
        }, function() { done(); });
    });

    // See https://github.com/Vizzuality/Windshaft/issues/31
    test("PostgreSQL errors are sent in response body",  function(done) {
        var sql = querystring.stringify({sql: "BROKEN QUERY"})
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/6/31/24.png?' + sql,
            method: 'GET'
        },{
        }, function(res) {
            assert.equal(res.statusCode, 400, res.statusCode + ': ' + res.body);
          // TODO: actual error may depend on backend language localization
          assert.ok(res.body.match(new RegExp(/syntax error/)),
              'Body does not contain the "syntax error" message: ' + res.body);
          done();
        });
    });

    test("get'ing a tile after post'ing a style should return an expected tile",  function(done){
      var style = "#test_table_3{marker-fill: blue;marker-line-color: black;}";
      Step(
        // Make sure we don't get the style we want, at first
        function getTile0() {
          var next = this;
          assert.response(server, {
            url: '/database/windshaft_test/table/test_table_3/13/4011/3088.png',
            method: 'GET',
            encoding: 'binary'
          },{
              status: 200,
              headers: { 'Content-Type': 'image/png' }
          }, function(res){
              assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_styled.png', IMAGE_EQUALS_TOLERANCE_PER_MIL, function(err) {
                  err = err ? null : new Error("Tile starts with unexpected style!");
                  next(err);
              });
          });
        },
        // Set the style we want
        function postStyle(err) {
          if ( err ) throw err;
          var next = this;
          //next(null, {statusCode: 200}); return;
          assert.response(server, {
              url: '/database/windshaft_test/table/test_table_3/style',
              method: 'POST',
              headers: {'Content-Type': 'application/x-www-form-urlencoded' },
              data: querystring.stringify({style: style})
          }, {}, function(res) { next(null, res); });
        },
        // Check style setting succeeded
        function checkPost(err, res) {
          if ( err ) throw err;
          assert.equal(res.statusCode, 200, res.body);
          //assert.equal(res.body, "ok");
          return null;
        },
        // Now check we get the tile styled as we specified
        function getTile(err, data) {
          if ( err ) throw err;
          var next = this;
          assert.response(server, {
            url: '/database/windshaft_test/table/test_table_3/13/4011/3088.png',
            method: 'GET',
            encoding: 'binary'
          },{
              status: 200,
              headers: { 'Content-Type': 'image/png' }
          }, function(res){
              assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_styled.png', IMAGE_EQUALS_TOLERANCE_PER_MIL, function(err) {
                  if (err) { next(err); return; }
                  next(null);
              });
          });
        },
        function finish(err) {
          assert.response(server, {
              url: '/database/windshaft_test/table/test_table_3/style',
              method: 'DELETE' },{}, function(res) { done(err); });
        }
      );
    });

    test("base and custom style tile referencing external resources do not affect each other", 
        function(done){
      var style = "#test_table_3{marker-file: url('http://localhost:" + res_serv_port + "/circle.svg'); marker-transform:'scale(0.2)'; }";
      var style2 = "#test_table_3{marker-file: url('http://localhost:" + res_serv_port + "/square.svg'); marker-transform:'scale(0.2)'; }";
      var stylequery = querystring.stringify({style: style});
      Step(
        function getCustomTile0() {
          var next = this;
          assert.response(server, {
            url: '/database/windshaft_test/table/test_table_3/13/4011/3088.png?' + stylequery,
            method: 'GET',
            encoding: 'binary'
          },{
              status: 200,
              headers: { 'Content-Type': 'image/png' }
          }, function(res){
              assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_svg1.png', IMAGE_EQUALS_TOLERANCE_PER_MIL, function(err) {
                  next(err);
              });
          });
        },
        // Set another style as default for table
        function postStyle(err) {
          if ( err ) throw err;
          var next = this;
          //next(null, {statusCode: 200}); return;
          assert.response(server, {
              url: '/database/windshaft_test/table/test_table_3/style',
              method: 'POST',
              headers: {'Content-Type': 'application/x-www-form-urlencoded' },
              data: querystring.stringify({style: style2})
          }, {}, function(res) { next(null, res); });
        },
        // Check style setting succeeded
        function checkPost(err, res) {
          if ( err ) throw err;
          assert.equal(res.statusCode, 200, res.body);
          //assert.equal(res.body, "ok");
          return null;
        },
        // Now check we get the tile styled as we specified
        function getBaseTile0(err, data) {
          if ( err ) throw err;
          var next = this;
          assert.response(server, {
            url: '/database/windshaft_test/table/test_table_3/13/4011/3088.png',
            method: 'GET',
            encoding: 'binary'
          },{}, function(res){
              assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
              assert.equal(res.headers['content-type'], "image/png");
              assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_svg2.png', IMAGE_EQUALS_TOLERANCE_PER_MIL, function(err) {
                  if (err) { next(err); return; }
                  next(null);
              });
          });
        },
        // Now fetch the custom style tile again
        function getCustomTile1(err) {
          if ( err ) throw err;
          var next = this;
          assert.response(server, {
            url: '/database/windshaft_test/table/test_table_3/13/4011/3088.png?cache_buster=2&' + stylequery,
            method: 'GET',
            encoding: 'binary'
          },{ }, function(res){
              assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
              assert.equal(res.headers['content-type'], "image/png");
              assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_svg1.png', IMAGE_EQUALS_TOLERANCE_PER_MIL, function(err) {
                  next(err);
              });
          });
        },
        // Now fetch the base style tile again 
        function getBaseTile1(err, data) {
          if ( err ) throw err;
          var next = this;
          assert.response(server, {
            url: '/database/windshaft_test/table/test_table_3/13/4011/3088.png?cache_buster=3',
            method: 'GET',
            encoding: 'binary'
          },{ }, function(res){
              assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
              assert.equal(res.headers['content-type'], "image/png");
              assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_svg2.png', IMAGE_EQUALS_TOLERANCE_PER_MIL, function(err) {
                  if (err) { next(err); return; }
                  next(null);
              });
          });
        },
        function finish(err) {
          assert.response(server, {
              url: '/database/windshaft_test/table/test_table_3/style',
              method: 'DELETE' },{}, function(res) { done(err); });
        }
      );
    });

    // See http://github.com/CartoDB/Windshaft/issues/107
    test("external resources get localized on renderer creation", 
        function(done){
      var style = "#test_table_3{marker-file: url('http://localhost:" + res_serv_port + "/square.svg'); marker-transform:'scale(0.2)'; }";
      var stylequery = querystring.stringify({style: style});
      var numrequests;
      Step(
        function getCustomTile0() {
          var next = this;
          assert.response(server, {
            url: '/database/windshaft_test/table/test_table_3/13/4011/3088.png?cache_buster=2.1&' + stylequery,
            method: 'GET',
            encoding: 'binary'
          },{
              status: 200,
              headers: { 'Content-Type': 'image/png' }
          }, function(res){
              numrequests = res_serv_status.numrequests;
              assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_svg2.png', IMAGE_EQUALS_TOLERANCE_PER_MIL, function(err) {
                  next(err);
              });
          });
        },
        function dropLocalizedResources(err) {
          if ( err ) throw err;
          var cachedir = global.environment.millstone.cache_basedir;
          rmdir_recursive_sync(cachedir);
          // Reset server to ensure all renderer caches are flushed
          server = new Windshaft.Server(ServerOptions);
          server.setMaxListeners(0);
          return null;
        },
        // Now fetch the custom style tile again
        function getCustomTile1(err) {
          if ( err ) throw err;
          var next = this;
          assert.response(server, {
            url: '/database/windshaft_test/table/test_table_3/13/4011/3088.png?cache_buster=2.2&' + stylequery,
            method: 'GET',
            encoding: 'binary'
          },{}, function(res){
              assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
              assert.equal(res_serv_status.numrequests, numrequests+1);
              assert.equal(res.headers['content-type'], "image/png");
              assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_svg2.png', IMAGE_EQUALS_TOLERANCE_PER_MIL, function(err) {
                  next(err);
              });
          });
        },
        // Now fetch the custom style tile again with an higher cache_buster,
        // checking that the external resource is NOT downloaded again
        function getCustomTile2(err) {
          if ( err ) throw err;
          var next = this;
          assert.response(server, {
            url: '/database/windshaft_test/table/test_table_3/13/4011/3088.png?cache_buster=2.3&' + stylequery,
            method: 'GET',
            encoding: 'binary'
          },{}, function(res){
              assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
              // millstone should not make another request
              assert.equal(res_serv_status.numrequests, numrequests+1);
              assert.equal(res.headers['content-type'], "image/png");
              assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_svg2.png', IMAGE_EQUALS_TOLERANCE_PER_MIL, function(err) {
                  next(err);
              });
          });
        },
        function finish(err) {
          assert.response(server, {
              url: '/database/windshaft_test/table/test_table_3/style',
              method: 'DELETE' },{}, function(res) { done(err); });
        }
      );
    });

    test("referencing unexistant external resources returns an error", 
        function(done){
      var url = "http://localhost:" + res_serv_port + "/notfound.png";
      var style = "#test_table_3{marker-file: url('" + url + "'); marker-transform:'scale(0.2)'; }";
      var stylequery = querystring.stringify({style: style});
      assert.response(server, {
        url: '/database/windshaft_test/table/test_table_3/13/4011/3088.png?' + stylequery,
        method: 'GET',
        encoding: 'binary'
      },{}, function(res){
        assert.equal(res.statusCode, 400, res.body);
        assert.equal(res.headers['content-type'], "application/json; charset=utf-8");
        assert.deepEqual(JSON.parse(res.body), {"error":"Unable to download '" + url + "' for 'style.mss' (server returned 404)"})
        done();
      });
    });

    // Test for https://github.com/Vizzuality/Windshaft/issues/65
    test("catching non-Error exception doesn't kill the backend", function(done) {

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

      Step(
        function doGet() {
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/table/test_table/0/0/0.png?sql=select+st_point(0,0)+as+the_geom,*+from+test_table_inserter(st_setsrid(st_point(0,0),4326),\'write\')',
              method: 'GET'
          }, {}, function(res, err) { next(err, res); });
        },
        function check(err, res) {
          if ( err ) throw err;
          assert.equal(res.statusCode, 400, res.statusCode + ': ' + ( res.statusCode != 200 ? res.body : '..' )); 
          var parsed = JSON.parse(res.body);
          assert.ok(parsed.error);
          var msg = parsed.error;
          assert.ok(msg.match(/read-only transaction/), msg);
          return null;
        },
        function finish(err) {
          assert.response(server, {
              url: '/database/windshaft_test/table/test_table/style',
              method: 'DELETE' },{}, function(res) { done(err); });
        }
      );

    });

    // See https://github.com/CartoDB/Windshaft/issues/167
    test("does not die on unexistent statsd host",  function(done) {
      Step(
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
          if ( err ) throw err;
          var next = this;
          var errors = [];
          // We need multiple requests to make sure
          // statsd_client eventually tries to send
          // stats _and_ DNS lookup is given enough
          // time (an interval is used later for that)
          var numreq = 10;
          var pending = numreq;
          var completed = function(err) {
            if ( err ) errors.push(err);
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
        function do_check(err, res) {
          if ( err ) throw err;
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
    test("does not send db details in connection error response",  function(done) {
      var base_key = 'map_style|windshaft_test|test_table';
      Step(
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
          if ( err ) throw err;
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/table/test_table/6/31/24.png',
              method: 'GET'
          },{}, function(res, err) { next(err, res); });
        },
        function do_check(err, res) {
          if ( err ) throw err;
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
            if ( e ) console.error(e);
            done(err);
          });
        }
      );
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
          if ( err ) errors.push(err);
          try { 
            assert.equal(matches.length, 0, "Left over redis keys:\n" + matches.join("\n"));
          } catch (err) {
            errors.push(err);
          }

          var cachedir = global.environment.millstone.cache_basedir;
          console.log("Dropping cache dir " + cachedir);
          rmdir_recursive_sync(cachedir);
              
          redis_client.flushall(function() {
            done(errors.length ? new Error(errors) : null);
          });
      });

    });
});

