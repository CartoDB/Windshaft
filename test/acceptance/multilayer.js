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

      var expected_token = "db314389e84f8f48b2ed153b63ec5bb4";
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
                 + '/layer0/0/0/0.grid.json?interactivity=cartodb_id',
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
                 + '/layer1/0/0/0.grid.json?interactivity=cartodb_id',
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
          var expected_token = "13d070ff630cbb2a3702a2b18af08efa";
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
                 + '/layer0/0/0/0.grid.json?interactivity=cartodb_id',
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
                 + '/layer0/0/0/0.grid.json?interactivity=cartodb_id',
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
            headers: {
              'Access-Control-Allow-Headers': 'X-Requested-With, X-Prototype-Version, X-CSRF-Token, Content-Type',
              'Access-Control-Allow-Origin': '*'
            }
        }, function() { done(); });
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

