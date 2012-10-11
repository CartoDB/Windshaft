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

    var default_style = '{marker-fill: #FF6600;marker-opacity: 1;marker-width: 8;marker-line-color: white;marker-line-width: 3;marker-line-opacity: 0.9;marker-placement: point;marker-type: ellipse;marker-allow-overlap: true;}';

    suiteSetup(function(done) {

      // Check that we start with an empty redis db 
      redis_client.keys("*", function(err, matches) {
          assert.equal(matches.length, 0);
      });

      // Start a server to test external resources
      res_serv = http.createServer( function(request, response) {
          var filename = '../../node_modules/grainstore/test/support/resources' + request.url; 
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
          assert.equal(parsed.style, '#test_table ' + default_style);
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

    test("get'ing a tile with default style and bogus sql should return 400 status",  function(done){
        var sql = querystring.stringify({sql: "BOGUS FROM test_table"});
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/13/4011/3088.png?' + sql,
            method: 'GET',
            encoding: 'binary'
        },{}, function(res) {
            assert.equal(res.statusCode, 400, res.statusCode + ': ' + res.body);
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
            assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_styled.png',  2, function(err, similarity) {
                if (err) throw err;
                assert.deepEqual(res.headers['content-type'], "image/png"); // TODO: isn't this a duplication ?
                done();
            });
        });
    });

    test("get'ing a tile with url specified style should return an expected tile twice",  function(done){
        var style = querystring.stringify({style: "#test_table{marker-fill: black;marker-line-color: black;}"});
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/13/4011/3088.png?' + style,
            method: 'GET',
            encoding: 'binary'
        },{
            status: 200,
            headers: { 'Content-Type': 'image/png' }
        }, function(res){
            assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_styled_black.png',  2, function(err, similarity) {
                if (err) throw err;
                assert.deepEqual(res.headers['content-type'], "image/png"); // TODO: isn't this a duplication ?
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
              assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_styled.png', 2, function(err, similarity) {
                  if (err) { next(err); return; }
                  assert.deepEqual(res.headers['content-type'], "image/png"); // TODO: isn't this a duplication ?
                  next(null);
              });
          });
        },
        function finish(err) {
          done(err);
        }
      );
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
            status: 500,
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
            status: 500,
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
      var style = "Map {background-color:#fff;}";
      Step(
        function postIt0() {
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/table/test_table_3/style',
              method: 'POST',
              headers: {'Content-Type': 'application/x-www-form-urlencoded' },
              data: querystring.stringify({style: style})
          }, {}, function(res) { next(null, res); });
        },
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
            assert.equal(parsed.version, '2.0.0');
            next(null);
          });
        },
        function postIt1() {
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/table/test_table_3/style',
              method: 'POST',
              headers: {'Content-Type': 'application/x-www-form-urlencoded' },
              data: querystring.stringify({style: style, version: '2.0.2'})
          }, {}, function(res) { next(null, res); });
        },
        function getIt1(err, res) {
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
            // specified is retained 
            assert.equal(parsed.version, '2.0.2');
            next(null);
          });
        },
        function postIt2() {
          var next = this;
          var from_mapnik_version = ( mapnik.versions.mapnik == '2.0.2' ? '2.0.0' : '2.0.2' );
          assert.response(server, {
              url: '/database/windshaft_test/table/test_table_3/style',
              method: 'POST',
              headers: {'Content-Type': 'application/x-www-form-urlencoded' },
              data: querystring.stringify({style: style, version: from_mapnik_version, convert: true})
          }, {}, function(res) { next(null, res); });
        },
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
            assert.equal(parsed.style, style);
            // specified is retained 
            assert.equal(parsed.version, mapnik.versions.mapnik); 
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
            url: '/database/windshaft_test/table/test_table/13/4011/3088.grid.json',
            method: 'GET'
        },{
            status: 200,
            headers: { 'Content-Type': 'text/javascript; charset=utf-8; charset=utf-8' }
        }, function(res){
            assert.utfgridEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088.grid.json', 2, done);
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

    test("get'ing a json with default style and nointeractivity should return a grid",  function(done){
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/13/4011/3088.grid.json',
            method: 'GET'
        },{
            status: 200,
            headers: { 'Content-Type': 'text/javascript; charset=utf-8; charset=utf-8' }
        }, function(res){
            var expected_json = {};
            assert.deepEqual(JSON.parse(res.body).data, expected_json);
            done();
        });
    });

    test("get'ing a json with default style and sql should return a constrained grid",  function(done){
        var sql = querystring.stringify({sql: "SELECT * FROM test_table limit 2"})
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/13/4011/3088.grid.json?' + sql,
            method: 'GET'
        },{
            status: 200,
            headers: { 'Content-Type': 'text/javascript; charset=utf-8; charset=utf-8' }
        }, function(res){
            assert.utfgridEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_limit_2.grid.json', 2, done);
        });
    });

    ////////////////////////////////////////////////////////////////////
    //
    // DELETE STYLE
    //
    ////////////////////////////////////////////////////////////////////

    test("deleting a style returns 200, calls beforeStateChange, calls afterStyleDelete and returns default therafter",  function(done){
        var style = 'Map {background-color:#fff;}';
        var def_style = "#test_table_3 " + default_style;

        // TODO: use Step ?
        server.beforeStateChangeCalls = 0;

        assert.response(server, {
            url: '/database/windshaft_test/table/test_table_3/style',
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded' },
            data: querystring.stringify({style: style})
        },{}, function(res) {

            assert.equal(res.statusCode, 200, res.body);
            assert.equal(server.afterStyleDeleteCalls, undefined);
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
                    body: JSON.stringify({style: def_style})
                }, function() { done(); } );

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

    suiteTeardown(function() {

      // Close the resources server
      res_serv.close();

      // Check that we left the redis db empty
      redis_client.keys("*", function(err, matches) {
          assert.equal(matches.length, 0, "Left over redis keys:\n" + matches.join("\n"));
      });

      redis_client.flushall();
    });
});

