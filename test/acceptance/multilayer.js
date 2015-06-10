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
var http = require('http');

describe('multilayer', function() {

    var server = new Windshaft.Server(ServerOptions);
    server.setMaxListeners(0);
    var redis_client = redis.createClient(ServerOptions.redis.port);
    var res_serv; // resources server
    var res_serv_port = 8033; // FIXME: make configurable ?
    mapnik.register_system_fonts();
    var available_system_fonts = _.keys(mapnik.fontFiles());

    var IMAGE_EQUALS_TOLERANCE_PER_MIL = 20;

    function checkCORSHeaders(res) {
      assert.equal(res.headers['access-control-allow-headers'], 'X-Requested-With, X-Prototype-Version, X-CSRF-Token');
      assert.equal(res.headers['access-control-allow-origin'], '*');
    }

    before(function(done) {
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

    after(function(done) {
        // Close the resources server
        res_serv.close(done);
    });

    // See https://github.com/Vizzuality/Windshaft/issues/70
    it("post layergroup with encoding in content-type", function(done) {
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
      var expected_token;
      step(
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
          if ( err ) {
              errors.push(err.message);
          }
          redis_client.exists("map_cfg|" +  expected_token, function(err, exists) {
              if ( err ) {
                  errors.push(err.message);
              }
              assert.ok(exists, "Missing expected token " + expected_token + " from redis");
              redis_client.del("map_cfg|" +  expected_token, function(err) {
                if ( err ) {
                    errors.push(err.message);
                }
                if ( errors.length ) {
                    done(new Error(errors));
                } else {
                    done(null);
                }
              });
          });
        }
      );
    });

    // See https://github.com/Vizzuality/Windshaft/issues/71
    it("single layer with multiple css sections", function(done) {
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
      step(
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
          assert.ifError(err);
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/' + expected_token + '/0/0/0.png',
              method: 'GET',
              encoding: 'binary'
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              assert.equal(res.headers['content-type'], "image/png");
              checkCORSHeaders(res);
              assert.imageEqualsFile(res.body, './test/fixtures/test_bigpoint_red.png', IMAGE_EQUALS_TOLERANCE_PER_MIL,
                  function(err) {
                  next(err);
              });
          });
        },
        function finish(err) {
          var errors = [];
          if ( err ) {
              errors.push(err.message);
          }
          redis_client.exists("map_cfg|" +  expected_token, function(err, exists) {
              if ( err ) {
                  errors.push(err.message);
              }
              assert.ok(exists, "Missing expected token " + expected_token + " from redis");
              redis_client.del("map_cfg|" +  expected_token, function(err) {
                if ( err ) {
                    errors.push(err.message);
                }
                if ( errors.length ) {
                    done(new Error(errors));
                } else {
                    done(null);
                }
              });
          });
        }
      );
    });

    it("layergroup with 2 layers, each with its style", function(done) {

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

      var expected_token;
      step(
        function do_post()
        {
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup',
              method: 'POST',
              headers: {'Content-Type': 'application/json' },
              data: JSON.stringify(layergroup)
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
              // CORS headers should be sent with response
              // from layergroup creation via POST
              checkCORSHeaders(res);
              var parsedBody = JSON.parse(res.body);
              if ( expected_token ) {
                  assert.deepEqual(parsedBody, {layergroupid: expected_token, layercount: 2});
              } else {
                  expected_token = parsedBody.layergroupid;
              }
              next(null, res);
          });
        },
        function do_get_tile(err)
        {
          assert.ifError(err);
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/' + expected_token + '/0/0/0.png',
              method: 'GET',
              encoding: 'binary'
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              assert.equal(res.headers['content-type'], "image/png");
              assert.imageEqualsFile(res.body, './test/fixtures/test_table_0_0_0_multilayer1.png',
                  IMAGE_EQUALS_TOLERANCE_PER_MIL, function(err) {
                  next(err);
              });
          });
        },
        function do_get_grid0(err)
        {
          assert.ifError(err);
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/' + expected_token + '/0/0/0/0.grid.json',
              method: 'GET'
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              assert.equal(res.headers['content-type'], "application/json; charset=utf-8");
              assert.utfgridEqualsFile(res.body, './test/fixtures/test_table_0_0_0_multilayer1.layer0.grid.json', 2,
                function(err/*, similarity*/) {
                  next(err);
              });
          });
        },
        function do_get_grid1(err)
        {
          assert.ifError(err);
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/' + expected_token +
                  '/1/0/0/0.grid.json?interactivity=cartodb_id',
              method: 'GET'
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              assert.equal(res.headers['content-type'], "application/json; charset=utf-8");
              assert.utfgridEqualsFile(res.body, './test/fixtures/test_table_0_0_0_multilayer1.layer1.grid.json', 2,
                function(err/*, similarity*/) {
                  next(err);
              });
          });
        },
        function finish(err) {
          var errors = [];
          if ( err ) {
              errors.push(err.message);
          }
          redis_client.exists("map_cfg|" +  expected_token, function(err, exists) {
              if ( err ) {
                  errors.push(err.message);
              }
              assert.ok(exists, "Missing expected token " + expected_token + " from redis");
              redis_client.del("map_cfg|" +  expected_token, function(err) {
                if ( err ) {
                    errors.push(err.message);
                }
                if ( errors.length ) {
                    done(new Error(errors));
                } else {
                    done(null);
                }
              });
          });
        }
      );
    });

    it("layergroup with 2 layers, each with its style, GET method", function(done) {

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

      var expected_token;
      step(
        function do_get()
        {
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup?' + querystring.stringify({
                  config: JSON.stringify(layergroup)
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
              if ( expected_token ) {
                  assert.deepEqual(parsedBody, {layergroupid: expected_token, layercount: 2});
              } else {
                  expected_token = parsedBody.layergroupid;
              }
              next(null, res);
          });
        },
        function do_get_tile(err)
        {
          assert.ifError(err);
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/' + expected_token + '/0/0/0.png',
              method: 'GET',
              encoding: 'binary'
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              assert.equal(res.headers['content-type'], "image/png");
              assert.imageEqualsFile(res.body, './test/fixtures/test_table_0_0_0_multilayer1.png',
                  IMAGE_EQUALS_TOLERANCE_PER_MIL, function(err) {
                  next(err);
              });
          });
        },
        function do_get_grid0(err)
        {
          assert.ifError(err);
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/' + expected_token +
                  '/0/0/0/0.grid.json?interactivity=cartodb_id',
              method: 'GET'
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              assert.equal(res.headers['content-type'], "application/json; charset=utf-8");
              assert.utfgridEqualsFile(res.body, './test/fixtures/test_table_0_0_0_multilayer1.layer0.grid.json', 2,
                function(err/*, similarity*/) {
                  next(err);
              });
          });
        },
        function do_get_grid1(err)
        {
          assert.ifError(err);
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/' + expected_token +
                  '/1/0/0/0.grid.json?interactivity=cartodb_id',
              method: 'GET'
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              assert.equal(res.headers['content-type'], "application/json; charset=utf-8");
              assert.utfgridEqualsFile(res.body, './test/fixtures/test_table_0_0_0_multilayer1.layer1.grid.json', 2,
                function(err/*, similarity*/) {
                  next(err);
              });
          });
        },
        function finish(err) {
          var errors = [];
          if ( err ) {
              errors.push(err.message);
          }
          redis_client.exists("map_cfg|" +  expected_token, function(err, exists) {
              if ( err ) {
                  errors.push(err.message);
              }
              assert.ok(exists, "Missing expected token " + expected_token + " from redis");
              redis_client.del("map_cfg|" +  expected_token, function(err) {
                if ( err ) {
                    errors.push(err.message);
                }
                if ( errors.length ) {
                    done(new Error(errors));
                } else {
                    done(null);
                }
              });
          });
        }
      );
    });

    it("layergroup with 2 layers, GET method, JSONP", function(done) {

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

      var expected_token = "cb0a407726cc8cb47711e90a30dd9422";
      step(
        function do_get_token()
        {
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup?' + querystring.stringify({
                  config: JSON.stringify(layergroup),
                  callback: 'jsonp_test'
              }),
              method: 'GET',
              headers: {'Content-Type': 'application/json' }
          }, {}, function(res, err) { next(err, res); });
        },
        function do_check_token(err, res) {
          assert.ifError(err);
          assert.equal(res.statusCode, 200, res.body);
          assert.equal(res.body, 'jsonp_test(' + JSON.stringify({
              layergroupid: expected_token,
              metadata: {
                  layers: [
                      { type: "mapnik", "meta":{} },
                      { type: "mapnik", "meta":{} }
                  ]
              },
              layercount: 2
          }) + ');');

          // TODO: check caching headers !
          return null;
        },
        function do_get_tile(err)
        {
          assert.ifError(err);
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/' + expected_token + '/0/0/0.png',
              method: 'GET',
              encoding: 'binary'
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              assert.equal(res.headers['content-type'], "image/png");
              assert.imageEqualsFile(res.body, './test/fixtures/test_table_0_0_0_multilayer1.png',
                  IMAGE_EQUALS_TOLERANCE_PER_MIL, function(err) {
                  next(err);
              });
          });
        },
        function do_get_grid0(err)
        {
          assert.ifError(err);
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/' + expected_token +
                  '/0/0/0/0.grid.json?interactivity=cartodb_id',
              method: 'GET'
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              assert.equal(res.headers['content-type'], "application/json; charset=utf-8");
              assert.utfgridEqualsFile(res.body, './test/fixtures/test_table_0_0_0_multilayer1.layer0.grid.json', 2,
                function(err/*, similarity*/) {
                  next(err);
              });
          });
        },
        function do_get_grid1(err)
        {
          assert.ifError(err);
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/' + expected_token +
                  '/1/0/0/0.grid.json?interactivity=cartodb_id',
              method: 'GET'
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              assert.equal(res.headers['content-type'], "application/json; charset=utf-8");
              assert.utfgridEqualsFile(res.body, './test/fixtures/test_table_0_0_0_multilayer1.layer1.grid.json', 2,
                function(err/*, similarity*/) {
                  next(err);
              });
          });
        },
        function finish(err) {
          var errors = [];
          if ( err ) {
              errors.push(err.message);
          }
          redis_client.exists("map_cfg|" +  expected_token, function(err, exists) {
              if ( err ) {
                  errors.push(err.message);
              }
              assert.ok(exists, "Missing expected token " + expected_token + " from redis");
              redis_client.del("map_cfg|" +  expected_token, function(err) {
                if ( err ) {
                    errors.push(err.message);
                }
                if ( errors.length ) {
                    done(new Error(errors));
                } else {
                    done(null);
                }
              });
          });
        }
      );
    });

    it("layergroup with 3 mixed layers, mapnik torque and attributes", function(done) {

      var layergroup =  {
        version: '1.1.0',
        layers: [
           { options: {
               sql: 'select cartodb_id, ST_Translate(the_geom, 50, 0) as the_geom from test_table limit 2',
               cartocss: '#layer { marker-fill:red; marker-width:32; marker-allow-overlap:true; }',
               cartocss_version: '2.0.1',
               interactivity: [ 'cartodb_id' ]
             } },
           { options: {
               sql: 'select cartodb_id, cartodb_id*10 as n, ST_Translate(the_geom, -50, 0) as the_geom' +
                   ' from test_table ORDER BY cartodb_id limit 2 offset 2',
               cartocss: '#layer { marker-fill:blue; marker-allow-overlap:true; }',
               cartocss_version: '2.0.2',
               interactivity: [ 'cartodb_id' ],
               attributes: { id: 'cartodb_id', columns: ['n'] }
             } },
           { type: 'torque', options: {
               sql: "select cartodb_id, '1970-01-01'::date as d," +
                   " ST_SnapToGrid(the_geom_webmercator,1e10) as the_geom_webmercator " +
                   "from test_table WHERE cartodb_id = 4",
               cartocss: 'Map { -torque-frame-count:1; -torque-resolution:1; -torque-time-attribute:d; ' +
                   '-torque-aggregation-function:"count(*)"; } #layer { marker-fill:blue; marker-allow-overlap:true; }'
             } }
        ]
      };

      var expected_token;
      step(
        function do_get()
        {
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup',
              method: 'POST',
              headers: {'Content-Type': 'application/json' },
              data: JSON.stringify(layergroup)
          }, {}, function(res, err) {
              next(err, res);
          });
        },
        function check_create(err, res) {
          assert.ifError(err);
          assert.equal(res.statusCode, 200, res.body);
          var parsed = JSON.parse(res.body);
          expected_token = parsed.layergroupid;
          return null;
        },
        function do_get_tile(err)
        {
          assert.ifError(err);
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/' + expected_token + '/0/0/0.png',
              method: 'GET',
              encoding: 'binary'
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              assert.equal(res.headers['content-type'], "image/png");
              assert.imageEqualsFile(res.body, './test/fixtures/test_table_0_0_0_multilayer1.png',
                  IMAGE_EQUALS_TOLERANCE_PER_MIL, function(err) {
                  next(err);
              });
          });
        },
        function do_get_grid0(err)
        {
          assert.ifError(err);
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/' + expected_token +
                  '/0/0/0/0.grid.json?interactivity=cartodb_id',
              method: 'GET'
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              assert.equal(res.headers['content-type'], "application/json; charset=utf-8");
              assert.utfgridEqualsFile(res.body, './test/fixtures/test_table_0_0_0_multilayer1.layer0.grid.json', 2,
                function(err/*, similarity*/) {
                  next(err);
              });
          });
        },
        function do_get_grid1(err)
        {
          assert.ifError(err);
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/' + expected_token +
                  '/1/0/0/0.grid.json?interactivity=cartodb_id',
              method: 'GET'
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              assert.equal(res.headers['content-type'], "application/json; charset=utf-8");
              assert.utfgridEqualsFile(res.body, './test/fixtures/test_table_0_0_0_multilayer1.layer1.grid.json', 2,
                function(err/*, similarity*/) {
                  next(err);
              });
          });
        },
        function do_get_attr1(err)
        {
          assert.ifError(err);
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/' + expected_token + '/1/attributes/4',
              method: 'GET'
          }, {}, function(res, err) {
              next(err, res);
          });
        },
        function do_check_attr1(err, res) {
          assert.ifError(err);
          assert.equal(res.statusCode, 200, res.body);
          assert.equal(res.headers['content-type'], "application/json; charset=utf-8");
          var parsed = JSON.parse(res.body);
          assert.deepEqual(parsed, {n:40});
          return null;
        },
        function do_get_torque2(err)
        {
          assert.ifError(err);
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/' + expected_token + '/2/0/0/0.json.torque',
              method: 'GET'
          }, {}, function(res, err) { next(err, res); });
        },
        function do_check_torque2(err, res) {
          assert.ifError(err);
          assert.equal(res.statusCode, 200, res.body);
          assert.equal(res.headers['content-type'], "application/json; charset=utf-8");
          var parsed = JSON.parse(res.body);
          assert.deepEqual(parsed[0].vals__uint8, [1]);
          assert.deepEqual(parsed[0].dates__uint16, [0]);
          assert.equal(parsed[0].x__uint8, 128);
          assert.equal(parsed[0].y__uint8, 128);
          return null;
        },
        function do_get_torque1(err)
        {
// Layer 1 is not a torque layer...
// See https://github.com/CartoDB/Windshaft/issues/136
          assert.ifError(err);
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/' + expected_token + '/1/0/0/0.json.torque',
              method: 'GET'
          }, {}, function(res, err) { next(err, res); });
        },
        function do_check_torque1(err, res) {
          assert.ifError(err);
          assert.equal(res.statusCode, 400, res.statusCode + ': ' + res.body);
          var parsed = JSON.parse(res.body);
          assert.ok(parsed.errors, res.body);
          assert.equal(parsed.errors.length, 1);
          var msg = parsed.errors[0];
          assert.ok(msg.match(/Unsupported format json.torque/i), msg);
          return null;
        },
        function finish(err) {
//if ( err ) console.log(err.stack);
          var errors = [];
          if ( err ) {
              errors.push(''+err);
          }
          redis_client.exists("map_cfg|" +  expected_token, function(err, exists) {
              if ( err ) {
                  errors.push(''+err);
              }
              assert.ok(exists, "Missing expected token " + expected_token + " from redis");
              redis_client.del("map_cfg|" +  expected_token, function(err) {
                if ( err ) {
                    errors.push(err.message);
                }
                if ( errors.length ) {
                    done(new Error(errors.join(',')));
                } else {
                    done(null);
                }
              });
          });
        }
      );
    });

    it("check that distinct maps result in distinct tiles", function(done) {

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
      step(
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
          assert.ifError(err);
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/' + token1 + '/0/0/0.png',
              method: 'GET',
              encoding: 'binary'
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              assert.equal(res.headers['content-type'], "image/png");
              assert.imageEqualsFile(res.body, './test/fixtures/test_table_0_0_0_multilayer2.png',
                  IMAGE_EQUALS_TOLERANCE_PER_MIL, function(err) {
                  next(err);
              });
          });
        },
        function do_get_grid1(err)
        {
          assert.ifError(err);
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/' + token1 + '/0/0/0/0.grid.json?interactivity=cartodb_id',
              method: 'GET'
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              assert.equal(res.headers['content-type'], "application/json; charset=utf-8");
              assert.utfgridEqualsFile(res.body, './test/fixtures/test_table_0_0_0_multilayer1.layer0.grid.json', 2,
                function(err/*, similarity*/) {
                  next(err);
              });
          });
        },
        function do_get_tile2(err)
        {
          assert.ifError(err);
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/' + token2 + '/0/0/0.png',
              method: 'GET',
              encoding: 'binary'
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              assert.equal(res.headers['content-type'], "image/png");
              assert.imageEqualsFile(res.body, './test/fixtures/test_table_0_0_0_multilayer3.png',
                  IMAGE_EQUALS_TOLERANCE_PER_MIL, function(err) {
                  next(err);
              });
          });
        },
        function do_get_grid_layer2(err)
        {
          assert.ifError(err);
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/' + token2 + '/0/0/0/0.grid.json?interactivity=cartodb_id',
              method: 'GET'
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              assert.equal(res.headers['content-type'], "application/json; charset=utf-8");
              assert.utfgridEqualsFile(res.body, './test/fixtures/test_table_0_0_0_multilayer1.layer1.grid.json', 2,
                function(err/*, similarity*/) {
                  next(err);
              });
          });
        },
        function finish(err) {
          var errors = [];
          if ( err ) {
              errors.push(err.message);
          }
          redis_client.keys('map_cfg|*', function(err, matches) {
              if ( err ) {
                  errors.push(err.message);
              }
              assert.equal(matches.length, 2);
              assert.ok(_.indexOf(matches, 'map_cfg|'+token1) > -1,
                        "Missing expected token " + token1 + " from redis");
              assert.ok(_.indexOf(matches, 'map_cfg|'+token2) > -1,
                        "Missing expected token " + token2 + " from redis");
              var cb = function(err/*, deleted*/) {
                if ( err ) {
                    errors.push(err.message);
                }
                if ( errors.length ) {
                    done(new Error(errors));
                } else {
                    done(null);
                }
              };
              redis_client.del(matches, cb);
          });
        }
      );
    });

    it("layers are rendered in definition order", function(done) {

      var layergroup =  {
        version: '1.0.1',
        layers: [
           { options: {
               sql: "select st_setsrid('LINESTRING(-60 -60,-60 60)'::geometry, 4326) as the_geom",
               cartocss_version: '2.0.2',
               cartocss: '#layer { line-width:16; line-color:#ff0000; }'
             } },
           { options: {
               sql: "select st_setsrid('LINESTRING(-100 0,100 0)'::geometry, 4326) as the_geom",
               cartocss_version: '2.0.2',
               cartocss: '#layer { line-width:16; line-color:#00ff00; }'
             } },
           { options: {
               sql: "select st_setsrid('LINESTRING(60 -60,60 60)'::geometry, 4326) as the_geom",
               cartocss_version: '2.0.2',
               cartocss: '#layer { line-width:16; line-color:#0000ff; }'
             } }
        ]
      };

      var expected_token; // = "32994445c0a4525432fcd7013bf6524c";
      step(
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
              if ( expected_token ) {
                  assert.deepEqual(parsedBody, {layergroupid: expected_token, layercount: 3});
              } else {
                  expected_token = parsedBody.layergroupid;
              }
              next(null, res);
            } catch (err) { next(err); }
          });
        },
        function do_get_tile(err)
        {
          assert.ifError(err);
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/' + expected_token + '/0/0/0.png',
              method: 'GET',
              encoding: 'binary'
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              assert.equal(res.headers['content-type'], "image/png");
              assert.imageEqualsFile(res.body, './test/fixtures/test_table_0_0_0_multilayer4.png',
                  IMAGE_EQUALS_TOLERANCE_PER_MIL, function(err) {
                  next(err);
              });
          });
        },
        function finish(err) {
          var errors = [];
          if ( err ) {
              errors.push(err.message);
          }
          redis_client.exists("map_cfg|" +  expected_token, function(err, exists) {
              if ( err ) {
                  errors.push(err.message);
              }
              assert.ok(exists, "Missing expected token " + expected_token + " from redis");
              redis_client.del("map_cfg|" +  expected_token, function(err) {
                if ( err ) {
                    errors.push(err.message);
                }
                if ( errors.length ) {
                    done(new Error(errors));
                } else {
                    done(null);
                }
              });
          });
        }
      );
    });

    it("quotes in CartoCSS", function(done) {

      var layergroup =  {
        version: '1.0.1',
        layers: [
           { options: {
               sql: "select 'single''quote' as n, 'SRID=4326;POINT(0 0)'::geometry as the_geom",
               cartocss: '#s [n="single\'quote" ] { marker-fill:red; }',
               cartocss_version: '2.1.0'
             } },
           { options: {
               sql: "select 'double\"quote' as n, 'SRID=4326;POINT(2 0)'::geometry as the_geom",
               cartocss: '#s [n="double\\"quote" ] { marker-fill:red; }',
               cartocss_version: '2.1.0'
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
          redis_client.del("map_cfg|" +  expected_token, function(/*err*/) {
            done();
          });
      });
    });

    // See https://github.com/CartoDB/Windshaft/issues/90
    it("exponential notation in CartoCSS filter", function(done) {

      var layergroup =  {
        version: '1.0.1',
        layers: [
           { options: {
               sql: "select 1.0 as n, 'SRID=4326;POINT(0 0)'::geometry as the_geom",
               cartocss: '#s [n=1e-4 ] { marker-fill:red; }',
               cartocss_version: '2.1.0'
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
          redis_client.del("map_cfg|" +  expected_token, function(/*err*/) {
            done();
          });
      });
    });

    // See https://github.com/CartoDB/Windshaft/issues/94
    it("unknown text-face-name", function(done) {

      var layergroup =  {
        version: '1.0.1',
        layers: [
           { options: {
               sql: "select 1.0 as n, 'SRID=4326;POINT(0 0)'::geometry as the_geom",
               cartocss: '#s { text-name: [n]; text-face-name: "<%= font %>"; }',
               cartocss_version: '2.1.0'
             } }
        ]
      };

      var tpl = JSON.stringify(layergroup);

      step(
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
          assert.ifError(err);
          assert.equal(res.statusCode, 400, res.statusCode + ': ' + res.body);
          var parsedBody = JSON.parse(res.body);
          assert.equal(parsedBody.errors.length, 1);
          var errmsg = parsedBody.errors[0];
          assert.ok(errmsg.match(/text-face-name.*bogus/), parsedBody.errors.toString());
          //, {"errors":["style0: Failed to find font face 'bogus'"]});
          return null;
        },
        function doGoodPost(err) {
          assert.ifError(err);
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup',
              method: 'POST',
              headers: {host: 'localhost', 'Content-Type': 'application/json' },
              data: _.template(tpl, {font:available_system_fonts[0]})
            }, function(res) { next(null, res); });
        },
        function checkGoodFont(err, res) {
          assert.ifError(err);
          assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
          var next = this;
          var parsed = JSON.parse(res.body);
          var expected_token = parsed.layergroupid;
          redis_client.del("map_cfg|" +  expected_token, next);
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

    it("get'ing options on layergroup should return CORS headers",  function(done){
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

    // See:
    //  - https://github.com/CartoDB/Windshaft/issues/103
    //  - https://github.com/mapnik/mapnik/issues/2121
    //  - https://github.com/mapnik/mapnik/issues/764
    it.skip("layergroup with datetime interactivity", function(done) {

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
      step(
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
              if ( expected_token ) {
                  assert.deepEqual(parsedBody, {layergroupid: expected_token, layercount: 3});
              } else {
                  expected_token = parsedBody.layergroupid;
              }
              next(null, res);
            } catch (err) { next(err); }
          });
        },
        function do_get_grid0(err)
        {
          assert.ifError(err);
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/' + expected_token + '/0/0/0/0.grid.json',
              method: 'GET'
          }, {}, function(res) {
              next(null, res);
          });
        },
        function do_check_grid(err, res)
        {
          assert.ifError(err);
          var next = this;
          assert.equal(res.statusCode, 200, res.body);
          assert.equal(res.headers['content-type'], "application/json; charset=utf-8");
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
          if ( err ) {
              errors.push(err.message);
          }
          redis_client.del("map_cfg|" +  expected_token, function(err) {
              if ( err ) {
                  errors.push(err.message);
              }
              if ( errors.length ) {
                  done(new Error(errors));
              } else {
                  done(null);
              }
          });
        }
      );
    });

    // See http://github.com/CartoDB/Windshaft/issues/157
    it("req2params is called only once for a multilayer post",
    function(done) {

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

      var expected_token;
      step(
        function do_post()
        {
          server.req2params_calls = 0;
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup',
              method: 'POST',
              headers: {'Content-Type': 'application/json' },
              data: JSON.stringify(layergroup)
          }, {}, function(res, err) { next(err,res); });
        },
        function check_post(err, res) {
          assert.ifError(err);
          assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
          var parsedBody = JSON.parse(res.body);
          expected_token = parsedBody.layergroupid;
          assert.equal(server.req2params_calls, 1);
          return null;
        },
        function finish(err) {
          var errors = [];
          if ( err ) {
              errors.push('' + err);
          }
          redis_client.exists("map_cfg|" +  expected_token, function(err, exists) {
              if ( err ) {
                  errors.push(err.message);
              }
              assert.ok(exists, "Missing expected token " + expected_token + " from redis");
              redis_client.del("map_cfg|" +  expected_token, function(err) {
                if ( err ) {
                    errors.push(err.message);
                }
                if ( errors.length ) {
                    done(new Error(errors));
                } else {
                    done(null);
                }
              });
          });
        }
      );
    });

    // See https://github.com/CartoDB/Windshaft/issues/163
    it("has different token for different database",
    function(done) {
      var layergroup =  {
        version: '1.0.1',
        layers: [
           { options: {
               sql: 'select 1 as i, 2::int2 as n, now() as t, ST_SetSRID(ST_MakePoint(0,0),3857) as the_geom',
               cartocss: '#layer { marker-fill:red; marker-width:32; marker-allow-overlap:true; }',
               cartocss_version: '2.0.1'
             } }
        ]
      };
      var token1, token2;
      step(
        function do_post_1()
        {
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup',
              method: 'POST',
              headers: {'Content-Type': 'application/json' },
              data: JSON.stringify(layergroup)
          }, {}, function(res, err) { next(err,res); });
        },
        function check_post_1(err, res) {
          assert.ifError(err);
          assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
          var parsedBody = JSON.parse(res.body);
          token1 = parsedBody.layergroupid;
          return null;
        },
        function do_post_2()
        {
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test2/layergroup',
              method: 'POST',
              headers: {'Content-Type': 'application/json' },
              data: JSON.stringify(layergroup)
          }, {}, function(res, err) { next(err,res); });
        },
        function check_post_2(err, res) {
          assert.ifError(err);
          assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
          var parsedBody = JSON.parse(res.body);
          token2 = parsedBody.layergroupid;
          assert.ok(token1 !== token2);
          return null;
        },
        function finish(err) {
          var errors = [];
          if ( err ) {
              errors.push('' + err);
          }
          redis_client.keys('map_cfg|*', function(err, matches) {
              if ( err ) {
                  errors.push(err.message);
              }
              assert.equal(matches.length, 2);
              assert.ok(_.indexOf(matches, 'map_cfg|'+token1) > -1,
                        "Missing expected token " + token1 + " from redis");
              assert.ok(_.indexOf(matches, 'map_cfg|'+token2) > -1,
                        "Missing expected token " + token2 + " from redis");
              var cb = function(err/*, deleted*/) {
                if ( err ) {
                    errors.push(err.message);
                }
                if ( errors.length ) {
                    done(new Error(errors));
                } else {
                    done(null);
                }
              };
              redis_client.del(matches, cb);
          });
        }
      );
    });

    // See http://github.com/CartoDB/Windshaft/issues/191
    it("mapnik layer with custom geom_column",
    function(done) {
      var layergroup =  {
        version: '1.0.1',
        layers: [
           { options: {
               sql: 'select 1 as i, ST_SetSRID(ST_MakePoint(0,0),4326) as g',
               cartocss: '#layer { marker-fill:red; marker-width:100; }',
               cartocss_version: '2.0.1',
               geom_column: 'g'
             } }
        ]
      };
      var token1;
      step(
        function do_post_1()
        {
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup',
              method: 'POST',
              headers: {'Content-Type': 'application/json' },
              data: JSON.stringify(layergroup)
          }, {}, function(res, err) { next(err,res); });
        },
        function check_post_1(err, res) {
          assert.ifError(err);
          assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
          var parsedBody = JSON.parse(res.body);
          token1 = parsedBody.layergroupid;
          return null;
        },
        function do_get_tile(err)
        {
          assert.ifError(err);
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/' + token1 + '/0/0/0.png',
              method: 'GET',
              encoding: 'binary'
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              assert.equal(res.headers['content-type'], "image/png");
              checkCORSHeaders(res);
              assert.imageEqualsFile(res.body, './test/fixtures/test_bigpoint_red.png',
                  IMAGE_EQUALS_TOLERANCE_PER_MIL, function(err) {
                  next(err);
              });
          });
        },
        function finish(err) {
          var errors = [];
          if ( err ) {
              errors.push('' + err);
          }
          redis_client.keys('map_cfg|*', function(err, matches) {
              if ( err ) {
                  errors.push(err.message);
              }
              try {
                assert.equal(matches.length, 1);
                assert.ok(_.indexOf(matches, 'map_cfg|'+token1) > -1,
                          "Missing expected token " + token1 + " from redis");
              } catch (e) {
                errors.push('' + e);
              }
              var cb = function(err/*, deleted*/) {
                if ( err ) {
                    errors.push(err.message);
                }
                if ( errors.length ) {
                    done(new Error(errors));
                } else {
                    done(null);
                }
              };
              redis_client.del(matches, cb);
          });
        }
      );
    });

});

