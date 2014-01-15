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

suite('multilayer', function() {

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
    mapnik.register_system_fonts();
    var available_system_fonts = _.keys(mapnik.fontFiles());

    checkCORSHeaders = function(res) {
      var h = res.headers['access-control-allow-headers'];
      assert.ok(h);
      assert.equal(h, 'X-Requested-With, X-Prototype-Version, X-CSRF-Token');
      var h = res.headers['access-control-allow-origin'];
      assert.ok(h);
      assert.equal(h, '*');
    };

    suiteSetup(function(done) {

      // Check that we start with an empty redis db 
      redis_client.keys("*", function(err, matches) {
          assert.equal(matches.length, 0, "redis keys present at setup time:\n" + matches.join("\n"));
      });

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

    test("post layergroup with wrong Content-Type", function(done) {
        assert.response(server, {
            url: '/database/windshaft_test/layergroup',
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded' }
        }, {}, function(res) {
            assert.equal(res.statusCode, 400, res.body);
            var parsedBody = JSON.parse(res.body);
            assert.deepEqual(parsedBody, {"errors":["layergroup POST data must be of type application/json"]});
            done();
        });
    });

    test("post layergroup with no layers", function(done) {
        assert.response(server, {
            url: '/database/windshaft_test/layergroup',
            method: 'POST',
            headers: {'Content-Type': 'application/json' }
        }, {}, function(res) {
            assert.equal(res.statusCode, 400, res.body);
            var parsedBody = JSON.parse(res.body);
            assert.deepEqual(parsedBody, {"errors":["Missing layers array from layergroup config"]});
            done();
        });
    });

    test("post layergroup jsonp errors are returned with 200 status", function(done) {
        assert.response(server, {
            url: '/database/windshaft_test/layergroup?callback=test',
            method: 'POST',
            headers: {'Content-Type': 'application/json' }
        }, {}, function(res) {
            assert.equal(res.statusCode, 200);
            assert.equal(res.body, 'test({"errors":["Missing layers array from layergroup config"]});');
            done();
        });
    });

    // See https://github.com/Vizzuality/Windshaft/issues/70
    test("post layergroup with encoding in content-type", function(done) {
      var layergroup =  {
        version: '1.0.1',
        layers: [
           { options: {
               sql: 'select the_geom from test_table limit 1',
               cartocss: '#layer { marker-fill:red }', 
               cartocss_version: '2.0.1'
             } }
        ]
      };
      var expected_token = "5c6c7b2e0bbaca41b14b0145f5eece48";
      Step(
        function do_post()
        {
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup',
              method: 'POST',
              headers: {'Content-Type': 'application/json; charset=utf-8' },
              data: JSON.stringify(layergroup)
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              var parsedBody = JSON.parse(res.body);
              expected_token = parsedBody.layergroupid;
              next();
          });
        },
        function finish(err) {
          var errors = [];
          if ( err ) errors.push(err.message);
          redis_client.keys("map_style|windshaft_test|~" + expected_token, function(err, matches) {
              if ( err ) errors.push(err.message);
              assert.equal(matches.length, 1, "Missing expected token " + expected_token + " from redis");
              redis_client.del(matches, function(err) {
                if ( err ) errors.push(err.message);
                if ( errors.length ) done(new Error(errors));
                else done(null);
              });
          });
        }
      );
    });

    // See https://github.com/Vizzuality/Windshaft/issues/71
    test("single layer with multiple css sections", function(done) {
      var layergroup =  {
        version: '1.0.1',
        layers: [
           { options: {
               sql: 'select st_setsrid(st_makepoint(0, 0), 4326) as the_geom',
               cartocss: '#layer { marker-fill:red; } #layer { marker-width:100; }', 
               cartocss_version: '2.0.1'
             } }
        ]
      };
      var expected_token; 
      Step(
        function do_post()
        {
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup',
              method: 'POST',
              headers: {'Content-Type': 'application/json' },
              data: JSON.stringify(layergroup)
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              var parsedBody = JSON.parse(res.body);
              expected_token = parsedBody.layergroupid;
              next();
          });
        },
        function do_get_tile(err)
        {
          if ( err ) throw err;
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/' + expected_token + '/0/0/0.png',
              method: 'GET',
              encoding: 'binary'
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              assert.equal(res.headers['content-type'], "image/png");
              checkCORSHeaders(res);
              assert.imageEqualsFile(res.body, './test/fixtures/test_bigpoint_red.png', 2,
                function(err, similarity) {
                  next(err);
              });
          });
        },
        function finish(err) {
          var errors = [];
          if ( err ) errors.push(err.message);
          redis_client.keys("map_style|windshaft_test|~" + expected_token, function(err, matches) {
              if ( err ) errors.push(err.message);
              assert.equal(matches.length, 1, "Missing expected token " + expected_token + " from redis");
              redis_client.del(matches, function(err) {
                if ( err ) errors.push(err.message);
                if ( errors.length ) done(new Error(errors));
                else done(null);
              });
          });
        }
      );
    });

    test("layergroup with 2 layers, each with its style", function(done) {

      var layergroup =  {
        version: '1.0.1',
        layers: [
           { options: {
               sql: 'select cartodb_id, ST_Translate(the_geom, 50, 0) as the_geom from test_table limit 2',
               cartocss: '#layer { marker-fill:red; marker-width:32; marker-allow-overlap:true; }', 
               cartocss_version: '2.0.1',
               interactivity: [ 'cartodb_id' ]
             } },
           { options: {
               sql: 'select cartodb_id, ST_Translate(the_geom, -50, 0) as the_geom from test_table limit 2 offset 2',
               cartocss: '#layer { marker-fill:blue; marker-allow-overlap:true; }', 
               cartocss_version: '2.0.2',
               interactivity: [ 'cartodb_id' ]
             } }
        ]
      };

      var expected_token = "5c6c7b2e0bbaca41b14b0145f5eece48";
      Step(
        function do_post()
        {
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup',
              method: 'POST',
              headers: {'Content-Type': 'application/json' },
              data: JSON.stringify(layergroup)
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              // CORS headers should be sent with response
              // from layergroup creation via POST
              checkCORSHeaders(res);
              var parsedBody = JSON.parse(res.body);
              if ( expected_token ) assert.deepEqual(parsedBody, {layergroupid: expected_token, layercount: 2});
              else expected_token = parsedBody.layergroupid;
              next(null, res);
          });
        },
        function do_get_tile(err)
        {
          if ( err ) throw err;
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/' + expected_token + '/0/0/0.png',
              method: 'GET',
              encoding: 'binary'
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              assert.equal(res.headers['content-type'], "image/png");
              assert.imageEqualsFile(res.body, './test/fixtures/test_table_0_0_0_multilayer1.png', 2,
                function(err, similarity) {
                  next(err);
              });
          });
        },
        function do_get_grid0(err)
        {
          if ( err ) throw err;
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/' + expected_token
                 + '/0/0/0/0.grid.json',
              method: 'GET'
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              assert.equal(res.headers['content-type'], "text/javascript; charset=utf-8; charset=utf-8");
              assert.utfgridEqualsFile(res.body, './test/fixtures/test_table_0_0_0_multilayer1.layer0.grid.json', 2,
                function(err, similarity) {
                  next(err);
              });
          });
        },
        function do_get_grid1(err)
        {
          if ( err ) throw err;
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/' + expected_token
                 + '/1/0/0/0.grid.json?interactivity=cartodb_id',
              method: 'GET'
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              assert.equal(res.headers['content-type'], "text/javascript; charset=utf-8; charset=utf-8");
              assert.utfgridEqualsFile(res.body, './test/fixtures/test_table_0_0_0_multilayer1.layer1.grid.json', 2,
                function(err, similarity) {
                  next(err);
              });
          });
        },
        function finish(err) {
          var errors = [];
          if ( err ) errors.push(err.message);
          redis_client.keys("map_style|windshaft_test|~" + expected_token, function(err, matches) {
              if ( err ) errors.push(err.message);
              assert.equal(matches.length, 1, "Missing expected token " + expected_token + " from redis");
              redis_client.del(matches, function(err) {
                if ( err ) errors.push(err.message);
                if ( errors.length ) done(new Error(errors));
                else done(null);
              });
          });
        }
      );
    });

    test("layergroup with 2 layers, each with its style, GET method", function(done) {

      var layergroup =  {
        version: '1.0.1',
        layers: [
           { options: {
               sql: 'select cartodb_id, ST_Translate(the_geom, 50, 0) as the_geom from test_table limit 2',
               cartocss: '#layer { marker-fill:red; marker-width:32; marker-allow-overlap:true; }', 
               cartocss_version: '2.0.1',
               interactivity: [ 'cartodb_id' ]
             } },
           { options: {
               sql: 'select cartodb_id, ST_Translate(the_geom, -50, 0) as the_geom from test_table limit 2 offset 2',
               cartocss: '#layer { marker-fill:blue; marker-allow-overlap:true; }', 
               cartocss_version: '2.0.2',
               interactivity: [ 'cartodb_id' ]
             } }
        ]
      };

      var expected_token = "5c6c7b2e0bbaca41b14b0145f5eece48";
      Step(
        function do_get()
        {
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup?'
                + querystring.stringify({
                    'config': JSON.stringify(layergroup)
                  }),
              method: 'GET',
              headers: {'Content-Type': 'application/json' }
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              // CORS headers should be sent with response
              // from layergroup creation via GET
              // see https://github.com/CartoDB/Windshaft/issues/92
              checkCORSHeaders(res);
              var parsedBody = JSON.parse(res.body);
              if ( expected_token ) assert.deepEqual(parsedBody, {layergroupid: expected_token, layercount: 2});
              else expected_token = parsedBody.layergroupid;
              next(null, res);
          });
        },
        function do_get_tile(err)
        {
          if ( err ) throw err;
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/' + expected_token + '/0/0/0.png',
              method: 'GET',
              encoding: 'binary'
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              assert.equal(res.headers['content-type'], "image/png");
              assert.imageEqualsFile(res.body, './test/fixtures/test_table_0_0_0_multilayer1.png', 2,
                function(err, similarity) {
                  next(err);
              });
          });
        },
        function do_get_grid0(err)
        {
          if ( err ) throw err;
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/' + expected_token
                 + '/0/0/0/0.grid.json?interactivity=cartodb_id',
              method: 'GET'
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              assert.equal(res.headers['content-type'], "text/javascript; charset=utf-8; charset=utf-8");
              assert.utfgridEqualsFile(res.body, './test/fixtures/test_table_0_0_0_multilayer1.layer0.grid.json', 2,
                function(err, similarity) {
                  next(err);
              });
          });
        },
        function do_get_grid1(err)
        {
          if ( err ) throw err;
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/' + expected_token
                 + '/1/0/0/0.grid.json?interactivity=cartodb_id',
              method: 'GET'
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              assert.equal(res.headers['content-type'], "text/javascript; charset=utf-8; charset=utf-8");
              assert.utfgridEqualsFile(res.body, './test/fixtures/test_table_0_0_0_multilayer1.layer1.grid.json', 2,
                function(err, similarity) {
                  next(err);
              });
          });
        },
        function finish(err) {
          var errors = [];
          if ( err ) errors.push(err.message);
          redis_client.keys("map_style|windshaft_test|~" + expected_token, function(err, matches) {
              if ( err ) errors.push(err.message);
              assert.equal(matches.length, 1, "Missing expected token " + expected_token + " from redis");
              redis_client.del(matches, function(err) {
                if ( err ) errors.push(err.message);
                if ( errors.length ) done(new Error(errors));
                else done(null);
              });
          });
        }
      );
    });

    test("layergroup with 2 layers, GET method, JSONP", function(done) {

      var layergroup =  {
        version: '1.0.1',
        layers: [
           { options: {
               sql: 'select cartodb_id, ST_Translate(the_geom, 50, 0) as the_geom from test_table limit 2',
               cartocss: '#layer { marker-fill:red; marker-width:32; marker-allow-overlap:true; }', 
               cartocss_version: '2.0.1',
               interactivity: [ 'cartodb_id' ]
             } },
           { options: {
               sql: 'select cartodb_id, ST_Translate(the_geom, -50, 0) as the_geom from test_table limit 2 offset 2',
               cartocss: '#layer { marker-fill:blue; marker-allow-overlap:true; }', 
               cartocss_version: '2.0.2',
               interactivity: [ 'cartodb_id' ]
             } }
        ]
      };

      var expected_token = "5c6c7b2e0bbaca41b14b0145f5eece48";
      Step(
        function do_get()
        {
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup?'
                + querystring.stringify({
                    'config': JSON.stringify(layergroup),
                    'callback': 'jsonp_test'
                  }),
              method: 'GET',
              headers: {'Content-Type': 'application/json' }
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              assert.equal(res.body, 'jsonp_test(' + JSON.stringify({layergroupid: expected_token, layercount: 2}) + ');');
              next(null, res);
          });
        },
        function do_get_tile(err)
        {
          if ( err ) throw err;
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/' + expected_token + '/0/0/0.png',
              method: 'GET',
              encoding: 'binary'
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              assert.equal(res.headers['content-type'], "image/png");
              assert.imageEqualsFile(res.body, './test/fixtures/test_table_0_0_0_multilayer1.png', 2,
                function(err, similarity) {
                  next(err);
              });
          });
        },
        function do_get_grid0(err)
        {
          if ( err ) throw err;
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/' + expected_token
                 + '/0/0/0/0.grid.json?interactivity=cartodb_id',
              method: 'GET'
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              assert.equal(res.headers['content-type'], "text/javascript; charset=utf-8; charset=utf-8");
              assert.utfgridEqualsFile(res.body, './test/fixtures/test_table_0_0_0_multilayer1.layer0.grid.json', 2,
                function(err, similarity) {
                  next(err);
              });
          });
        },
        function do_get_grid1(err)
        {
          if ( err ) throw err;
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/' + expected_token
                 + '/1/0/0/0.grid.json?interactivity=cartodb_id',
              method: 'GET'
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              assert.equal(res.headers['content-type'], "text/javascript; charset=utf-8; charset=utf-8");
              assert.utfgridEqualsFile(res.body, './test/fixtures/test_table_0_0_0_multilayer1.layer1.grid.json', 2,
                function(err, similarity) {
                  next(err);
              });
          });
        },
        function finish(err) {
          var errors = [];
          if ( err ) errors.push(err.message);
          redis_client.keys("map_style|windshaft_test|~" + expected_token, function(err, matches) {
              if ( err ) errors.push(err.message);
              assert.equal(matches.length, 1, "Missing expected token " + expected_token + " from redis");
              redis_client.del(matches, function(err) {
                if ( err ) errors.push(err.message);
                if ( errors.length ) done(new Error(errors));
                else done(null);
              });
          });
        }
      );
    });

    test("layergroup with no cartocss_version", function(done) {
      var layergroup =  {
        version: '1.0.0',
        layers: [
           { options: {
               sql: 'select cartodb_id, ST_Translate(the_geom, 50, 0) as the_geom from test_table limit 2',
               cartocss: '#layer { marker-fill:red; marker-width:32; marker-allow-overlap:true; }', 
             } }
        ]
      };
      assert.response(server, {
          url: '/database/windshaft_test/layergroup',
          method: 'POST',
          headers: {'Content-Type': 'application/json' },
          data: JSON.stringify(layergroup)
      }, {}, function(res) {
          assert.equal(res.statusCode, 400, res.body);
          var parsedBody = JSON.parse(res.body);
          assert.deepEqual(parsedBody, {errors:["Missing cartocss_version for layer 0 options"]});
          done();
      });
    });

    test("layergroup with global_cartocss_version", function(done) {
      var layergroup =  {
        version: '1.0.0',
        global_cartocss_version: '2.0.1',
        layers: [
           { options: {
               sql: 'select cartodb_id, ST_Translate(the_geom, 50, 0) as the_geom from test_table limit 2',
               cartocss: '#layer { marker-fill:red; marker-width:32; marker-allow-overlap:true; }', 
             } }
        ]
      };
      assert.response(server, {
          url: '/database/windshaft_test/layergroup',
          method: 'POST',
          headers: {'Content-Type': 'application/json' },
          data: JSON.stringify(layergroup)
      }, {}, function(res) {
          assert.equal(res.statusCode, 200, res.body);
          var parsedBody = JSON.parse(res.body);
          var expected_token = "7eb0c08cd6b07d7df671932855c5e80e";
          assert.deepEqual(parsedBody, {layergroupid:expected_token,"layercount":1});
          redis_client.del("map_style|windshaft_test|~" + expected_token, function(err) {
            done();
          });
      });
    });

    test("check that distinct maps result in distinct tiles", function(done) {

      var layergroup1 =  {
        version: '1.0.0',
        layers: [
           { options: {
               sql: 'select cartodb_id, ST_Translate(the_geom, 50, 0) as the_geom from test_table limit 2',
               cartocss: '#layer { marker-fill:red; marker-width:32; marker-allow-overlap:true; }', 
               cartocss_version: '2.0.1',
               interactivity: 'cartodb_id'
             } }
        ]
      };

      var layergroup2 =  {
        version: '1.0.0',
        layers: [
           { options: {
               sql: 'select cartodb_id, ST_Translate(the_geom, -50, 0) as the_geom from test_table limit 2 offset 2',
               cartocss: '#layer { marker-fill:blue; marker-allow-overlap:true; }', 
               cartocss_version: '2.0.2',
               interactivity: 'cartodb_id'
             } }
        ]
      };

      var token1, token2;
      Step(
        function do_post1()
        {
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup',
              method: 'POST',
              headers: {'Content-Type': 'application/json' },
              data: JSON.stringify(layergroup1)
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              var parsedBody = JSON.parse(res.body);
              token1 = parsedBody.layergroupid;
              assert.ok(token1, res.body);
              next(null);
          });
        },
        function do_post2()
        {
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup',
              method: 'POST',
              headers: {'Content-Type': 'application/json' },
              data: JSON.stringify(layergroup2)
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              var parsedBody = JSON.parse(res.body);
              token2 = parsedBody.layergroupid;
              assert.ok(token2);
              next(null);
          });
        },
        function do_get_tile1(err)
        {
          if ( err ) throw err;
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/' + token1 + '/0/0/0.png',
              method: 'GET',
              encoding: 'binary'
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              assert.equal(res.headers['content-type'], "image/png");
              assert.imageEqualsFile(res.body, './test/fixtures/test_table_0_0_0_multilayer2.png', 2,
                function(err, similarity) {
                  next(err);
              });
          });
        },
        function do_get_grid1(err)
        {
          if ( err ) throw err;
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/' + token1
                 + '/0/0/0/0.grid.json?interactivity=cartodb_id',
              method: 'GET'
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              assert.equal(res.headers['content-type'], "text/javascript; charset=utf-8; charset=utf-8");
              assert.utfgridEqualsFile(res.body, './test/fixtures/test_table_0_0_0_multilayer1.layer0.grid.json', 2,
                function(err, similarity) {
                  next(err);
              });
          });
        },
        function do_get_tile2(err)
        {
          if ( err ) throw err;
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/' + token2 + '/0/0/0.png',
              method: 'GET',
              encoding: 'binary'
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              assert.equal(res.headers['content-type'], "image/png");
              assert.imageEqualsFile(res.body, './test/fixtures/test_table_0_0_0_multilayer3.png', 2,
                function(err, similarity) {
                  next(err);
              });
          });
        },
        function do_get_grid_layer2(err)
        {
          if ( err ) throw err;
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/' + token2
                 + '/0/0/0/0.grid.json?interactivity=cartodb_id',
              method: 'GET'
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              assert.equal(res.headers['content-type'], "text/javascript; charset=utf-8; charset=utf-8");
              assert.utfgridEqualsFile(res.body, './test/fixtures/test_table_0_0_0_multilayer1.layer1.grid.json', 2,
                function(err, similarity) {
                  next(err);
              });
          });
        },
        function finish(err) {
          var errors = [];
          if ( err ) errors.push(err.message);
          var prefix = "map_style|windshaft_test|~";
          redis_client.keys(prefix+"*", function(err, matches) {
              if ( err ) errors.push(err.message);
              assert.equal(matches.length, 2);
              assert.ok(_.indexOf(matches, prefix+token1) > -1,
                        "Missing expected token " + token1 + " from redis");
              assert.ok(_.indexOf(matches, prefix+token2) > -1,
                        "Missing expected token " + token2 + " from redis");
              redis_client.del(matches, function(err) {
                if ( err ) errors.push(err.message);
                if ( errors.length ) done(new Error(errors));
                else done(null);
              });
          });
        }
      );
    });

    test("layers are rendered in definition order", function(done) {

      var layergroup =  {
        version: '1.0.1',
        global_cartocss_version: '2.0.2',
        layers: [
           { options: {
               sql: "select st_setsrid('LINESTRING(-60 -60,-60 60)'::geometry, 4326) as the_geom",
               cartocss: '#layer { line-width:16; line-color:#ff0000; }'
             } },
           { options: {
               sql: "select st_setsrid('LINESTRING(-100 0,100 0)'::geometry, 4326) as the_geom",
               cartocss: '#layer { line-width:16; line-color:#00ff00; }'
             } },
           { options: {
               sql: "select st_setsrid('LINESTRING(60 -60,60 60)'::geometry, 4326) as the_geom",
               cartocss: '#layer { line-width:16; line-color:#0000ff; }'
             } }
        ]
      };

      var expected_token = "32994445c0a4525432fcd7013bf6524c";
      Step(
        function do_post()
        {
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup',
              method: 'POST',
              headers: {'Content-Type': 'application/json' },
              data: JSON.stringify(layergroup)
          }, {}, function(res) {
            try {
              assert.equal(res.statusCode, 200, res.body);
              var parsedBody = JSON.parse(res.body);
              if ( expected_token ) assert.deepEqual(parsedBody, {layergroupid: expected_token, layercount: 3});
              else expected_token = parsedBody.layergroupid;
              next(null, res);
            } catch (err) { next(err); }
          });
        },
        function do_get_tile(err)
        {
          if ( err ) throw err;
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/' + expected_token + '/0/0/0.png',
              method: 'GET',
              encoding: 'binary'
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              assert.equal(res.headers['content-type'], "image/png");
              assert.imageEqualsFile(res.body, './test/fixtures/test_table_0_0_0_multilayer4.png', 2,
                function(err, similarity) {
                  next(err);
              });
          });
        },
        function finish(err) {
          var errors = [];
          if ( err ) errors.push(err.message);
          redis_client.keys("map_style|windshaft_test|~" + expected_token, function(err, matches) {
              if ( err ) errors.push(err.message);
              assert.equal(matches.length, 1, "Missing expected token " + expected_token + " from redis");
              redis_client.del(matches, function(err) {
                if ( err ) errors.push(err.message);
                if ( errors.length ) done(new Error(errors));
                else done(null);
              });
          });
        }
      );
    });

    test("sql/cartocss combination errors", function(done) {
      var layergroup =  {
        version: '1.0.1',
        global_cartocss_version: '2.0.2',
        layers: [{ options: {
           sql: "select 1 as i, 'LINESTRING(0 0, 1 0)'::geometry as the_geom",
           cartocss: '#layer [missing=1] { line-width:16; }'
        }}]
      };
      assert.response(server, {
          url: '/database/windshaft_test/layergroup',
          method: 'POST',
          headers: {'Content-Type': 'application/json' },
          data: JSON.stringify(layergroup)
      }, {}, function(res) {
        try {
          assert.equal(res.statusCode, 400, res.statusCode + ': ' + res.body);
          var parsed = JSON.parse(res.body);
          assert.ok(parsed);
          assert.equal(parsed.errors.length, 1);
          var error = parsed.errors[0];
          assert.ok(error.match(/column "missing" does not exist/m), error);
          // cannot check for error starting with style0 until a new enough mapnik
          // is used: https://github.com/mapnik/mapnik/issues/1924
          //assert.ok(error.match(/^style0/), "Error doesn't start with style0: " + error);
          // TODO: check which layer introduced the problem ?
          done();
        } catch (err) { done(err); }
      });
    });

    test("sql/interactivity combination error", function(done) {
      var layergroup =  {
        version: '1.0.1',
        global_cartocss_version: '2.0.2',
        layers: [
          { options: {
           sql: "select 1 as i, st_setsrid('LINESTRING(0 0, 1 0)'::geometry, 4326) as the_geom",
           cartocss: '#layer { line-width:16; }',
           interactivity: 'i'
          }},
          { options: {
           sql: "select 1 as i, st_setsrid('LINESTRING(0 0, 1 0)'::geometry, 4326) as the_geom",
           cartocss: '#layer { line-width:16; }'
          }},
          { options: {
           sql: "select 1 as i, st_setsrid('LINESTRING(0 0, 1 0)'::geometry, 4326) as the_geom",
           cartocss: '#layer { line-width:16; }',
           interactivity: 'missing'
          }}
        ]
      };
      assert.response(server, {
          url: '/database/windshaft_test/layergroup',
          method: 'POST',
          headers: {'Content-Type': 'application/json' },
          data: JSON.stringify(layergroup)
      }, {}, function(res) {
        try {
          assert.equal(res.statusCode, 400, res.statusCode + ': ' + res.body);
          var parsed = JSON.parse(res.body);
          assert.ok(parsed);
          assert.equal(parsed.errors.length, 1);
          var error = parsed.errors[0]; 
          assert.ok(error.match(/column "missing" does not exist/m), error);
          // TODO: check which layer introduced the problem ?
          done();
        } catch (err) { done(err); }
      });
    });

    test("blank CartoCSS error", function(done) {
      var layergroup =  {
        version: '1.0.1',
        global_cartocss_version: '2.0.2',
        layers: [
          { options: {
           sql: "select 1 as i, 'LINESTRING(0 0, 1 0)'::geometry as the_geom",
           cartocss: '#style { line-width:16 }',
           interactivity: 'i'
          }},
          { options: {
           sql: "select 1 as i, 'LINESTRING(0 0, 1 0)'::geometry as the_geom",
           cartocss: '',
           interactivity: 'i'
          }}
        ]
      };
      assert.response(server, {
          url: '/database/windshaft_test/layergroup',
          method: 'POST',
          headers: {'Content-Type': 'application/json' },
          data: JSON.stringify(layergroup)
      }, {}, function(res) {
        try {
          assert.equal(res.statusCode, 400, res.statusCode + ': ' + res.body);
          var parsed = JSON.parse(res.body);
          assert.ok(parsed);
          assert.equal(parsed.errors.length, 1);
          var error = parsed.errors[0]; 
          assert.ok(error.match(/^style1: CartoCSS is empty/), error);
          done();
        } catch (err) { done(err); }
      });
    });

    test("Invalid mapnik-geometry-type CartoCSS error", function(done) {
      var layergroup =  {
        version: '1.0.1',
        global_cartocss_version: '2.0.2',
        layers: [
          { options: {
           sql: "select 1 as i, 'LINESTRING(0 0, 1 0)'::geometry as the_geom",
           cartocss: '#style [mapnik-geometry-type=bogus] { line-width:16 }'
          }},
          { options: {
           sql: "select 1 as i, 'LINESTRING(0 0, 1 0)'::geometry as the_geom",
           cartocss: '#style [mapnik-geometry-type=bogus] { line-width:16 }'
          }}
        ]
      };
      assert.response(server, {
          url: '/database/windshaft_test/layergroup',
          method: 'POST',
          headers: {'Content-Type': 'application/json' },
          data: JSON.stringify(layergroup)
      }, {}, function(res) {
        try {
          assert.equal(res.statusCode, 400, res.statusCode + ': ' + res.body);
          var parsed = JSON.parse(res.body);
          assert.ok(parsed);
          assert.equal(parsed.errors.length, 1);
          var error = parsed.errors[0]; 
          // carto-0.9.3 used to say "Failed to parse expression",
          // carto-0.9.5 says "not a valid keyword"
          assert.ok(error.match(/^style0:.*(Failed|not a valid)/), error);
          // TODO: check which layer introduced the problem ?
          done();
        } catch (err) { done(err); }
      });
    });

    test("quotes in CartoCSS", function(done) {

      var layergroup =  {
        version: '1.0.1',
        layers: [
           { options: {
               sql: "select 'single''quote' as n, 'SRID=4326;POINT(0 0)'::geometry as the_geom",
               cartocss: '#s [n="single\'quote" ] { marker-fill:red; }',
               cartocss_version: '2.1.0',
             } },
           { options: {
               sql: "select 'double\"quote' as n, 'SRID=4326;POINT(2 0)'::geometry as the_geom",
               cartocss: '#s [n="double\\"quote" ] { marker-fill:red; }',
               cartocss_version: '2.1.0',
             } }
        ]
      };

      assert.response(server, {
          url: '/database/windshaft_test/layergroup',
          method: 'POST',
          headers: {host: 'localhost', 'Content-Type': 'application/json' },
          data: JSON.stringify(layergroup)
      }, {}, function(res) {
          assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
          var parsed = JSON.parse(res.body);
          var expected_token = parsed.layergroupid;
          redis_client.keys("map_style|windshaft_test|~" + expected_token, function(err, matches) {
            if ( ! err ) {
              redis_client.del(matches, function(err) {
                done();
              });
            }
          });
      });
    });

    // See https://github.com/CartoDB/Windshaft/issues/90
    test("exponential notation in CartoCSS filter", function(done) {

      var layergroup =  {
        version: '1.0.1',
        layers: [
           { options: {
               sql: "select 1.0 as n, 'SRID=4326;POINT(0 0)'::geometry as the_geom",
               cartocss: '#s [n=1e-4 ] { marker-fill:red; }',
               cartocss_version: '2.1.0',
             } }
        ]
      };
      assert.response(server, {
          url: '/database/windshaft_test/layergroup',
          method: 'POST',
          headers: {host: 'localhost', 'Content-Type': 'application/json' },
          data: JSON.stringify(layergroup)
      }, {}, function(res) {
          assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
          var parsed = JSON.parse(res.body);
          var expected_token = parsed.layergroupid;
          redis_client.keys("map_style|windshaft_test|~" + expected_token, function(err, matches) {
            if ( ! err ) {
              redis_client.del(matches, function(err) {
                done();
              });
            }
          });
      });
    });

    // See https://github.com/CartoDB/Windshaft/issues/94
    test("unknown text-face-name", function(done) {

      var layergroup =  {
        version: '1.0.1',
        layers: [
           { options: {
               sql: "select 1.0 as n, 'SRID=4326;POINT(0 0)'::geometry as the_geom",
               cartocss: '#s { text-name: [n]; text-face-name: "<%= font %>"; }',
               cartocss_version: '2.1.0',
             } }
        ]
      };

      var tpl = JSON.stringify(layergroup);

      Step(
        function doBadPost() {
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup',
              method: 'POST',
              headers: {host: 'localhost', 'Content-Type': 'application/json' },
              data: _.template(tpl, {font:'bogus'})
            }, function(res) { next(null, res); });
        },
        function checkBadFont(err, res) {
          if ( err ) throw err;
          assert.equal(res.statusCode, 400, res.statusCode + ': ' + res.body);
          var parsedBody = JSON.parse(res.body);
          assert.equal(parsedBody.errors.length, 1);
          var errmsg = parsedBody.errors[0];
          assert.ok(errmsg.match(/text-face-name.*bogus/), parsedBody.errors.toString());
          //, {"errors":["style0: Failed to find font face 'bogus'"]});
          return null;
        },
        function doGoodPost(err) {
          if ( err ) throw err;
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup',
              method: 'POST',
              headers: {host: 'localhost', 'Content-Type': 'application/json' },
              data: _.template(tpl, {font:available_system_fonts[0]})
            }, function(res) { next(null, res); });
        },
        function checkGoodFont(err, res) {
          if ( err ) throw err;
          assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
          var next = this;
          var parsed = JSON.parse(res.body);
          var expected_token = parsed.layergroupid;
          redis_client.keys("map_style|windshaft_test|~" + expected_token, function(err, matches) {
            redis_client.del(matches, next);
          });
        },
        function finish(err) {
          done(err);
        }
      );

    });

    ////////////////////////////////////////////////////////////////////
    //
    // OPTIONS LAYERGROUP
    //
    ////////////////////////////////////////////////////////////////////

    test("get'ing options on layergroup should return CORS headers",  function(done){
        assert.response(server, {
            url: '/database/windshaft_test/layergroup',
            method: 'OPTIONS'
        },{
            status: 200,
            // TODO: use checkCORSHeaders() function
            headers: {
              'Access-Control-Allow-Headers': 'X-Requested-With, X-Prototype-Version, X-CSRF-Token, Content-Type',
              'Access-Control-Allow-Origin': '*'
            }
        }, function() { done(); });
    });

    // See https://github.com/CartoDB/Windshaft/issues/103
    test.skip("layergroup with datetime interactivity", function(done) {

      var layergroup =  {
        version: '1.0.1',
        layers: [
           { options: {
               sql: 'select 1 as i, 2::int2 as n, now() as t, ST_SetSRID(ST_MakePoint(0,0),3857) as the_geom',
               cartocss: '#layer { marker-fill:red; }',
               cartocss_version: '2.1.1',
               interactivity: [ 'i', 't', 'n' ]
             } }
        ]
      };

      var expected_token;
      Step(
        function do_post()
        {
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup',
              method: 'POST',
              headers: {'Content-Type': 'application/json' },
              data: JSON.stringify(layergroup)
          }, {}, function(res) {
            try {
              assert.equal(res.statusCode, 200, res.body);
              var parsedBody = JSON.parse(res.body);
              if ( expected_token ) assert.deepEqual(parsedBody, {layergroupid: expected_token, layercount: 3});
              else expected_token = parsedBody.layergroupid;
              next(null, res);
            } catch (err) { next(err); }
          });
        },
        function do_get_grid0(err)
        {
          if ( err ) throw err;
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/' + expected_token
                 + '/0/0/0/0.grid.json',
              method: 'GET'
          }, {}, function(res) {
              next(null, res);
          })
        },
        function do_check_grid(err, res)
        {
          if ( err ) throw err;
          var next = this;
          assert.equal(res.statusCode, 200, res.body);
          assert.equal(res.headers['content-type'], "text/javascript; charset=utf-8; charset=utf-8");
          var grid = JSON.parse(res.body);
          assert.ok(grid);
          assert.ok(grid.hasOwnProperty('data'));
          assert.ok(grid.data.hasOwnProperty('1'));
          var data = grid.data[1];
          assert.ok(data.hasOwnProperty('n'), "Missing 'n' from grid data keys: " + _.keys(data));
          assert.ok(data.hasOwnProperty('i'), "Missing 'i' from grid data keys: " + _.keys(data));
          assert.ok(data.hasOwnProperty('t'), "Missing 't' from grid data keys: " + _.keys(data));
          next();
        },
        function finish(err) {
          var errors = [];
          if ( err ) errors.push(err.message);
          redis_client.keys("map_style|windshaft_test|~" + expected_token, function(err, matches) {
              if ( err ) errors.push(err.message);
              redis_client.del(matches, function(err) {
                if ( err ) errors.push(err.message);
                if ( errors.length ) done(new Error(errors));
                else done(null);
              });
          });
        }
      );
    });

    // TODO: check lifetime of layergroup!

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
          try {
            assert.equal(matches.length, 0, "Left over redis keys:\n" + matches.join("\n"));
          } catch (err2) {
            if ( err ) err.message += '\n' + err2.message;
            else err = err2;
          }
          redis_client.flushall(function() {
            done(err);
          });
      });

    });

});

