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

suite('server', function() {

    ////////////////////////////////////////////////////////////////////
    //
    // SETUP
    //
    ////////////////////////////////////////////////////////////////////

    var server = new Windshaft.Server(ServerOptions);
    server.setMaxListeners(0);
    var redis_client = redis.createClient(ServerOptions.redis.port);
    var res_serv; // resources server
    var res_serv_port = 8033; // FIXME: make configurable ?

    var default_style = semver.satisfies(mapnik.versions.mapnik, '<2.1.0')
    ?
      // 2.0.0 default
      '#<%= table %>{marker-fill: #FF6600;marker-opacity: 1;marker-width: 8;marker-line-color: white;marker-line-width: 3;marker-line-opacity: 0.9;marker-placement: point;marker-type: ellipse;marker-allow-overlap: true;}'
    :
      // 2.1.0 default
      '#<%= table %>[mapnik-geometry-type=1] {marker-fill: #FF6600;marker-opacity: 1;marker-width: 16;marker-line-color: white;marker-line-width: 3;marker-line-opacity: 0.9;marker-placement: point;marker-type: ellipse;marker-allow-overlap: true;}#<%= table %>[mapnik-geometry-type=2] {line-color:#FF6600; line-width:1; line-opacity: 0.7;}#<%= table %>[mapnik-geometry-type=3] {polygon-fill:#FF6600; polygon-opacity: 0.7; line-opacity:1; line-color: #FFFFFF;}';

    suiteSetup(function(done) {

      // Check that we start with an empty redis db 
      redis_client.keys("*", function(err, matches) {

        if ( err ) { done(err); return; }

        assert.equal(matches.length, 0, "redis keys present at setup time:\n" + matches.join("\n"));

        // Start a server to test external resources
        res_serv = http.createServer( function(request, response) {
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
    // GET INVALID
    //
    ////////////////////////////////////////////////////////////////////

    test("get call to server returns 200",  function(done){
        assert.response(server, {
            url: '/',
            method: 'GET'
        },{
            // FIXME: shouldn't this be a 404 ?
            status: 200
        }, function() { done(); } );
    });

    ////////////////////////////////////////////////////////////////////
    //
    // GET VERSION
    //
    ////////////////////////////////////////////////////////////////////

    test("get /version returns versions",  function(done){
        assert.response(server, {
            url: '/version',
            method: 'GET'
        },{
            status: 200
        }, function(res) {
          var parsed = JSON.parse(res.body);
          assert.ok(parsed.hasOwnProperty('windshaft'), "No 'windshaft' version in " + parsed);
          console.log("Windshaft: " + parsed.windshaft);
          assert.ok(parsed.hasOwnProperty('grainstore'), "No 'grainstore' version in " + parsed);
          console.log("Grainstore: " + parsed.grainstore);
          assert.ok(parsed.hasOwnProperty('node_mapnik'), "No 'node_mapnik' version in " + parsed);
          console.log("Node-mapnik: " + parsed.node_mapnik);
          assert.ok(parsed.hasOwnProperty('mapnik'), "No 'mapnik' version in " + parsed);
          console.log("Mapnik: " + parsed.mapnik);
          // TODO: check actual versions ?
          done();
        });
    });

    ////////////////////////////////////////////////////////////////////
    //
    // GET STYLE
    //
    ////////////////////////////////////////////////////////////////////

    test("get'ing blank style returns default style",  function(done){
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/style',
            method: 'GET'
        },{
            status: 200,
        }, function(res) {
          var parsed = JSON.parse(res.body);
          assert.equal(parsed.style, _.template(default_style, {table: 'test_table'}));
          // NOTE: we used to check that "style" was the only element of
          //       the response, but I don't think it makes sense.
          done();
        } );
    });

    ////////////////////////////////////////////////////////////////////
    //
    // GET TILE
    //
    ////////////////////////////////////////////////////////////////////

    test("get'ing a tile with default style should return an expected tile",  function(done){
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/13/4011/3088.png',
            method: 'GET',
            encoding: 'binary'
        },{
            status: 200,
            headers: { 'Content-Type': 'image/png' }
        }, function(res){
            assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088.png',  2, function(err, similarity) {
                if (err) throw err;
                assert.deepEqual(res.headers['content-type'], "image/png");
                done();
            });
        });
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
            assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_limit_2.png',  2, function(err, similarity) {
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

    test("get'ing a tile from a query with no geometry field returns 404 status",  function(done){
        var sql = querystring.stringify({sql: "SELECT 1"});
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/13/4011/3088.png?' + sql,
            method: 'GET',
            encoding: 'binary'
        },{}, function(res) {
            assert.equal(res.statusCode, 404, res.statusCode + ': ' + res.body);
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
            assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_styled.png',  2,
              function(err, similarity) {
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
            assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_styled.png',  2,
              function(err, similarity) {
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
            assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_styled_black.png',  2,
              function(err, similarity) {
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
            assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_styled_black.png',  2,
              function(err, similarity) {
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
            assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_styled_black.png',  2,
              function(err, similarity) {
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
            assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_styled_black.png', 2, function(err, similarity) {
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
                    assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_styled_black.png', 2, function(err, similarity) {
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
                            assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088.png', 2, function(err, similarity) {
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

    test("processXML can edit generated XML",  function(done) {
        assert.response(server, {
            // NOTE: overrideDBUser is hanlded by the req2params installed by ../support/server_options.js
            //       and forces change of authentication in the XML
            url: '/database/windshaft_test/table/test_table/6/31/24.png?cache_buster=666&overrideDBUser=fake',
            method: 'GET'
        },{
        }, function(res) {
          assert.equal(res.statusCode, 404, res.body);
          // TODO: also test that a new request with no overrideDBUser gets permission to access the tile ?
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
              assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_styled.png', 2,
              function(err, similarity) {
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
              assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_styled.png', 2,
                function(err, similarity) {
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
        function getCustumTile0() {
          var next = this;
          assert.response(server, {
            url: '/database/windshaft_test/table/test_table_3/13/4011/3088.png?' + stylequery,
            method: 'GET',
            encoding: 'binary'
          },{
              status: 200,
              headers: { 'Content-Type': 'image/png' }
          }, function(res){
              assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_svg1.png', 2,
              function(err, similarity) {
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
          },{
              status: 200,
              headers: { 'Content-Type': 'image/png' }
          }, function(res){
              assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_svg2.png', 2,
                function(err, similarity) {
                  if (err) { next(err); return; }
                  next(null);
              });
          });
        },
        // Now fetch the custom style tile again
        function getCustumTile1() {
          var next = this;
          assert.response(server, {
            url: '/database/windshaft_test/table/test_table_3/13/4011/3088.png?cache_buster=2&' + stylequery,
            method: 'GET',
            encoding: 'binary'
          },{
              status: 200,
              headers: { 'Content-Type': 'image/png' }
          }, function(res){
              assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_svg1.png', 2,
              function(err, similarity) {
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
          },{
              status: 200,
              headers: { 'Content-Type': 'image/png' }
          }, function(res){
              assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_svg2.png', 2,
                function(err, similarity) {
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


    ////////////////////////////////////////////////////////////////////
    //
    // OPTIONS TILE
    //
    ////////////////////////////////////////////////////////////////////

    test("get'ing options on tile should return CORS headers",  function(done){
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table_3/13/4011/3088.png',
            method: 'OPTIONS'
        },{
            status: 200,
            headers: {
              'Access-Control-Allow-Headers': 'X-Requested-With, X-Prototype-Version, X-CSRF-Token',
              'Access-Control-Allow-Origin': '*'
            }
        }, function() { done(); });
    });


    ////////////////////////////////////////////////////////////////////
    //
    // OPTIONS STYLE
    //
    ////////////////////////////////////////////////////////////////////

    test("get'ing options on style should return CORS headers",  function(done){
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/style',
            method: 'OPTIONS'
        },{
            status: 200,
            headers: {
              'Access-Control-Allow-Headers': 'X-Requested-With, X-Prototype-Version, X-CSRF-Token',
              'Access-Control-Allow-Origin': '*'
            }
        }, function() { done(); });
    });

    ////////////////////////////////////////////////////////////////////
    //
    // POST STYLE
    //
    ////////////////////////////////////////////////////////////////////

    test("post'ing no style returns 400 with errors",  function(done){
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/style',
            method: 'POST'
        },{
            status: 400,
            body: '{"error":"must send style information"}'
        }, function() { done(); } );
    });

    test("post'ing bad style returns 400 with error",  function(done){
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table_2/style',
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded' },
            data: querystring.stringify({style: '#test_table_2{backgxxxxxround-color:#fff;}'})
        },{
            status: 400,
            body: /Unrecognized rule: backgxxxxxround-color/ 
        }, function() { done(); } );
    });

    test("post'ing multiple bad styles returns 400 with error array",  function(done){
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table_2/style',
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded' },
            data: querystring.stringify({style: '#test_table_2{backgxxxxxround-color:#fff;foo:bar}'})
        },{
            status: 400,
            body: /Unrecognized rule: backgxxxxxround-color.*Unrecognized rule: foo/ 
        }, function() { done(); } );
    });

    test("post'ing good style returns 200 and both beforeStateChange and afterStyleChange are called", function(done){
        server.beforeStateChangeCalls = 0;
        server.afterStyleChangeCalls = 0;
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table_3/style',
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded' },
            data: querystring.stringify({style: 'Map{background-color:#fff;}'})
        }, {}, function(res) {
              assert.equal(server.beforeStateChangeCalls, 1);
              assert.equal(server.afterStyleChangeCalls, 1);
              assert.equal(res.statusCode, 200, res.body);
              done();
        } );
    });


    test("post'ing good style returns 200 then getting returns it",  function(done){
      var style = "Map { background-color:#fff; }";
      Step(
        // Post with no style_version
        function postIt0() {
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/table/test_table_3/style',
              method: 'POST',
              headers: {'Content-Type': 'application/x-www-form-urlencoded' },
              data: querystring.stringify({style: style})
          }, {}, function(res) { next(null, res); });
        },
        // Get with no style_convert
        function getIt0(err, res) {
          if ( err ) { done(err); return; }
          var next = this;
          assert.equal(res.statusCode, 200, res.body);
          assert.response(server, {
              url: '/database/windshaft_test/table/test_table_3/style',
              method: 'GET'
          },{
              status: 200,
          }, function(res) {
            var parsed = JSON.parse(res.body);
            assert.equal(parsed.style, style);
            // unspecified resolves to 2.0.0
            assert.equal(parsed.style_version, '2.0.0');
            next(null);
          });
        },
        // Now post with a style_version
        function postIt1(err) {
          if ( err ) { done(err); return; }
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/table/test_table_3/style',
              method: 'POST',
              headers: {'Content-Type': 'application/x-www-form-urlencoded' },
              data: querystring.stringify({style: style, style_version: '2.0.2'})
          }, {}, function(res) { next(null, res); });
        },
        // Get again with no style_convert
        function getIt1(err, res) {
          if ( err ) { done(err); return; }
          var next = this;
          assert.equal(res.statusCode, 200, res.body);
          assert.response(server, {
              url: '/database/windshaft_test/table/test_table_3/style',
              method: 'GET'
          },{}, function(res) {
            assert.equal(res.statusCode, 200, res.body);
            var parsed = JSON.parse(res.body);
            assert.equal(parsed.style, style);
            // specified is retained 
            assert.equal(parsed.style_version, '2.0.2');
            next(null);
          });
        },
        // Now get with style_convert
        function getIt1(err) {
          if ( err ) { done(err); return; }
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/table/test_table_3/style?style_convert=true',
              method: 'GET'
          },{}, function(res) {
            assert.equal(res.statusCode, 200, res.body);
            var parsed = JSON.parse(res.body);
            assert.equal(parsed.style, style);
            // specified is retained 
            assert.equal(parsed.style_version, mapnik.versions.mapnik);
            next(null);
          });
        },
        // Now post with a style_version AND style_convert
        function postIt2(err) {
          if ( err ) { done(err); return; }
          var next = this;
          var from_mapnik_version = ( mapnik.versions.mapnik == '2.0.2' ? '2.0.0' : '2.0.2' );
          assert.response(server, {
              url: '/database/windshaft_test/table/test_table_3/style',
              method: 'POST',
              headers: {'Content-Type': 'application/x-www-form-urlencoded' },
              data: querystring.stringify({style: style, style_version: from_mapnik_version, style_convert: true})
          }, {}, function(res) { next(null, res); });
        },
        // Get with no style_convert
        function getIt2(err, res) {
          if ( err ) { done(err); return; }
          var next = this;
          assert.equal(res.statusCode, 200, res.body);
          assert.response(server, {
              url: '/database/windshaft_test/table/test_table_3/style',
              method: 'GET'
          },{
              status: 200,
          }, function(res) {
            var parsed = JSON.parse(res.body);
            // NOTE: no conversion expected for the specific style (may change)
            assert.equal(parsed.style, style);
            // Style converted to target
            assert.equal(parsed.style_version, mapnik.versions.mapnik); 
            done();
          });
        }
      );
    });

    ////////////////////////////////////////////////////////////////////
    //
    // GET GRID 
    //
    ////////////////////////////////////////////////////////////////////

    test("get'ing a json with default style should return an grid",  function(done){
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/13/4011/3088.grid.json?interactivity=name',
            method: 'GET'
        },{}, function(res){
            assert.equal(res.statusCode, 200, res.body);
            assert.deepEqual(res.headers['content-type'], 'text/javascript; charset=utf-8; charset=utf-8');
            assert.utfgridEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088.grid.json', 2, done);
        });
    });

    test("grid jsonp",  function(done){
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/13/4011/3088.grid.json?interactivity=name&callback=test',
            method: 'GET'
        },{}, function(res){
            assert.equal(res.statusCode, 200, res.body);
            assert.deepEqual(res.headers['content-type'], 'text/javascript; charset=utf-8; charset=utf-8');
            var regexp = '^test\\((.*)\\);$';
            var matches = res.body.match(regexp);
            assert.equal(matches.length, 2, 'Unexpected JSONP response:'  + res.body);
            assert.utfgridEqualsFile(matches[1], './test/fixtures/test_table_13_4011_3088.grid.json', 2, done);
        });
    });

    test("get'ing a json with default style and single interactivity should return a grid",  function(done){
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/13/4011/3088.grid.json?interactivity=name',
            method: 'GET'
        },{
            status: 200,
            headers: { 'Content-Type': 'text/javascript; charset=utf-8; charset=utf-8' }
        }, function(res){
            var expected_json = {
                "1":{"name":"Hawai"},
                "2":{"name":"El Estocolmo"},
                "3":{"name":"El Rey del Tallarín"},
                "4":{"name":"El Lacón"},
                "5":{"name":"El Pico"}
            };
            assert.deepEqual(JSON.parse(res.body).data, expected_json);
            done();
        });
    });

    test("get'ing a json with default style and multiple interactivity should return a grid",  function(done){
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/13/4011/3088.grid.json?interactivity=name,address',
            method: 'GET'
        },{
            status: 200,
            headers: { 'Content-Type': 'text/javascript; charset=utf-8; charset=utf-8' }
        }, function(res){
            var expected_json = {
                "1":{"address":"Calle de Pérez Galdós 9, Madrid, Spain","name":"Hawai"},
                "2":{"address":"Calle de la Palma 72, Madrid, Spain","name":"El Estocolmo"},
                "3":{"address":"Plaza Conde de Toreno 2, Madrid, Spain","name":"El Rey del Tallarín"},
                "4":{"address":"Manuel Fernández y González 8, Madrid, Spain","name":"El Lacón"},
                "5":{"address":"Calle Divino Pastor 12, Madrid, Spain","name":"El Pico"}
            };
            assert.deepEqual(JSON.parse(res.body).data, expected_json);
            done();
        });
    });

    test("get'ing a json with default style and no interactivity should return an error",  function(done){
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/13/4011/3088.grid.json',
            method: 'GET'
        },{
        }, function(res){
            assert.equal(res.statusCode, 400);
            assert.deepEqual(JSON.parse(res.body), {error: 'Missing interactivity parameter'});
            done();
        });
    });

    test("get'ing a json with default style and sql should return a constrained grid",  function(done){
        var sql = querystring.stringify({sql: "SELECT * FROM test_table limit 2"});
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/13/4011/3088.grid.json?interactivity=cartodb_id&' + sql,
            method: 'GET'
        },{
            status: 200,
            headers: { 'Content-Type': 'text/javascript; charset=utf-8; charset=utf-8' }
        }, function(res){
            assert.utfgridEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_limit_2.grid.json', 2, done);
        });
    });

    // See http://github.com/Vizzuality/Windshaft/issues/50
    test("get'ing a json with no data should return an empty grid",  function(done){
        var sql = querystring.stringify({sql: "SELECT * FROM test_table limit 0"});
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/13/4011/3088.grid.json?interactivity=name&' + sql,
            method: 'GET'
        },{
            status: 200,
            headers: { 'Content-Type': 'text/javascript; charset=utf-8; charset=utf-8' }
        }, function(res){
            assert.utfgridEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_empty.grid.json', 2, done);
        });
    });

    // Another test for http://github.com/Vizzuality/Windshaft/issues/50
    // this time with interactivity and cache_buster
    test("get'ing a json with no data but interactivity should return an empty grid",  function(done){
        var sql = querystring.stringify({
          sql: "SELECT * FROM test_table limit 0",
          interactivity: 'cartodb_id',
          cache_buster: 4});
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/13/4011/3088.grid.json?' + sql,
            method: 'GET'
        },{
            status: 200,
            headers: { 'Content-Type': 'text/javascript; charset=utf-8; charset=utf-8' }
        }, function(res){
            assert.utfgridEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_empty.grid.json', 2, done);
        });
    });

    // See https://github.com/Vizzuality/Windshaft-cartodb/issues/67
    test("get'ing a solid grid while changing interactivity fields",  function(done){
        var baseurl = '/database/windshaft_test/table/test_big_poly/3/2/2.grid.json?'
        var style211 = "#test_big_poly{polygon-fill:blue;}"; // for solid
        baseurl += querystring.stringify({
          style: style211,
          style_version: '2.1.0'}
        );
        baseurl += '&';
        assert.response(server, {
            url: baseurl + 'interactivity=name',
            method: 'GET'
        },{}, function(res){
            assert.equal(res.statusCode, 200, res.body);
            var expected_data = { "1":{"name":"west"} };
            assert.deepEqual(JSON.parse(res.body).data, expected_data);
            assert.response(server, {
                url: baseurl + 'interactivity=cartodb_id',
                method: 'GET'
            },{}, function(res){
                assert.equal(res.statusCode, 200, res.body);
                var expected_data = { "1":{"cartodb_id":"1"} };
                assert.deepEqual(JSON.parse(res.body).data, expected_data);
                done();
            });
        });
    });


    ////////////////////////////////////////////////////////////////////
    //
    // DELETE STYLE
    //
    ////////////////////////////////////////////////////////////////////

    test("deleting a style returns 200, calls beforeStateChange, calls afterStyleDelete and returns default therafter",  function(done){
        var style = 'Map {background-color:#fff;}';
        var def_style = _.template(default_style, {table: 'test_table_3'});

        // TODO: use Step ?
        server.beforeStateChangeCalls = 0;
        server.afterStyleDeleteCalls = 0;

        assert.response(server, {
            url: '/database/windshaft_test/table/test_table_3/style',
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded' },
            data: querystring.stringify({style: style})
        },{}, function(res) {

            assert.equal(res.statusCode, 200, res.body);
            assert.equal(server.afterStyleDeleteCalls, 0);
            assert.equal(server.beforeStateChangeCalls, 1);

            assert.response(server, {
                url: '/database/windshaft_test/table/test_table_3/style',
                method: 'DELETE'
            },{
            }, function() {

                assert.equal(res.statusCode, 200, res.body);
                assert.equal(server.afterStyleDeleteCalls, 1);
                assert.equal(server.beforeStateChangeCalls, 2);

                assert.response(server, {
                    url: '/database/windshaft_test/table/test_table_3/style',
                    method: 'GET'
                },{
                    status: 200,
                }, function(res) {
                  var parsed = JSON.parse(res.body);
                  assert.equal(parsed.style, def_style);
                  done();
                } );

            });

        });
    });

    test("deleting all styles leaves redis clean", function(done) {

      Step(

        function del_test_table() {
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/table/test_table/style',
              method: 'DELETE'
          },{}, function(res) {
            try {
              assert.equal(res.statusCode, 200, res.body);
              next();
            } catch (err) {
              done(err);
            }
          });
        },
        function del_test_table_2(err) {
          if ( err ) throw err;
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/table/test_table_2/style',
              method: 'DELETE'
          },{}, function(res) {
            try {
              assert.equal(res.statusCode, 200, res.body);
              next();
            } catch (err) {
              done(err);
            }
          });
        },
        function del_test_table_3(err) {
          if ( err ) throw err;
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/table/test_table_3/style',
              method: 'DELETE'
          },{}, function(res) {
            try {
              assert.equal(res.statusCode, 200, res.body);
              next();
            } catch (err) {
              done(err);
            }
          });
        },
        function del_test_big_poly(err) {
          if ( err ) throw err;
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/table/test_big_poly/style',
              method: 'DELETE'
          },{}, function(res) {
            try {
              assert.equal(res.statusCode, 200, res.body);
              next();
            } catch (err) {
              done(err);
            }
          });
        },
        function checkRedis(err) {
          if ( err ) throw err;
          var next = this;
          // Check that we left the redis db empty
          redis_client.keys("map_style|*", function(err, matches) {
            assert.equal(matches.length, 0, "Left over redis keys:\n" + matches.join("\n"));
            next();
          });
        },
        function finish(err) {
          done(err);
        }
      );
    });

    ////////////////////////////////////////////////////////////////////
    //
    // TEARDOWN
    //
    ////////////////////////////////////////////////////////////////////

    suiteTeardown(function(done) {

      // Close the resources server
      res_serv.close();

      // Check that we left the redis db empty
      redis_client.keys("*", function(err, matches) {
          assert.equal(matches.length, 0, "Left over redis keys:\n" + matches.join("\n"));
          redis_client.flushall(done);
      });

    });
});

