require('../support/test_helper');

var assert        = require('../support/assert');
var redis         = require('redis');
var step          = require('step');
var Windshaft     = require('../../lib/windshaft');
var ServerOptions = require('../support/server_options');
var TestClient = require('../support/test_client');

describe('attributes', function() {

    var server = new Windshaft.Server(ServerOptions);
    server.setMaxListeners(0);
    var redis_client = redis.createClient(ServerOptions.redis.port);

    function createMapConfig(sql, id, columns) {
        return {
            version: '1.1.0',
            layers: [
                {
                    type: 'mapnik',
                    options: {
                        sql: "select 1 as id, 'SRID=4326;POINT(0 0)'::geometry as the_geom",
                        cartocss: '#style { }',
                        cartocss_version: '2.0.1'
                    }
                },
                {
                    type: 'mapnik',
                    options: {
                        sql: sql || "select 1 as i, 6 as n, 'SRID=4326;POINT(0 0)'::geometry as the_geom",
                        attributes: {
                            id: id || 'i',
                            columns: columns || ['n']
                        },
                        cartocss: '#style { }',
                        cartocss_version: '2.0.1'
                    }
                }
          ]
        };
    }

    var NO_ATTRIBUTES_LAYER = 0;
    var ATTRIBUTES_LAYER = 1;

    function checkCORSHeaders(res) {
      assert.equal(res.headers['access-control-allow-headers'], 'X-Requested-With, X-Prototype-Version, X-CSRF-Token');
      assert.equal(res.headers['access-control-allow-origin'], '*');
    }

    it("cannot be fetched from layer not having an attributes spec", function(done) {

        var testClient = new TestClient(createMapConfig());
        testClient.getFeatureAttributes(NO_ATTRIBUTES_LAYER, 1, function (err) {
            assert.ok(err);
            assert.equal(err.message, 'Layer 0 has no exposed attributes');
            done();
        });

    });

    it("can only be fetched from layer having an attributes spec", function(done) {

        var testClient = new TestClient(createMapConfig());
        testClient.getFeatureAttributes(ATTRIBUTES_LAYER, 1, function (err, attributes) {
            assert.ok(!err);
            assert.deepEqual(attributes, { n: 6 });
            done();
        });

    });

    it("cannot fetch attributes for non-existent feature id", function(done) {

        var testClient = new TestClient(createMapConfig());
        testClient.getFeatureAttributes(ATTRIBUTES_LAYER, -666, function (err) {
            assert.ok(err);
            assert.equal(err.message, '0 features in layer 1 are identified by fid -666');
            assert.equal(err.http_status, 404);
            done();
        });

    });

    // See https://github.com/CartoDB/Windshaft/issues/131
    it("are checked at map creation time",
    function(done) {

      var mapconfig = createMapConfig('SELECT * FROM test_table', 'unexistant', ['cartodb_id']);

      step(
        function do_post()
        {
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup',
              method: 'POST',
              headers: {'Content-Type': 'application/json' },
              data: JSON.stringify(mapconfig)
          }, {}, function(res, err) { next(err, res); });
        },
        function checkPost(err, res) {
          assert.ifError(err);
          assert.equal(res.statusCode, 404, res.statusCode + ': ' + (res.statusCode===200?'...':res.body));
          var parsed = JSON.parse(res.body);
          assert.ok(parsed.errors);
          assert.equal(parsed.errors.length, 1);
          var msg = parsed.errors[0];
          assert.equal(msg, 'column "unexistant" does not exist');
          return null;
        },
        function finish(err) {
          done(err);
        }
      );
    });

    it("can be used with jsonp", function(done) {

      var expected_token;
      step(
        function do_post()
        {
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup',
              method: 'POST',
              headers: {'Content-Type': 'application/json' },
              data: JSON.stringify(createMapConfig())
          }, {}, function(res, err) { next(err, res); });
        },
        function checkPost(err, res) {
          assert.ifError(err);
          assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
          // CORS headers should be sent with response
          // from layergroup creation via POST
          checkCORSHeaders(res);
          var parsedBody = JSON.parse(res.body);
          assert.equal(parsedBody.metadata.layers.length, 2);
          expected_token = parsedBody.layergroupid;
          return null;
        },
        function do_get_attr_0(err)
        {
          assert.ifError(err);
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/' + expected_token +
                   '/0/attributes/1?callback=test',
              method: 'GET'
          }, {}, function(res, err) { next(err, res); });
        },
        function check_error_0(err, res) {
          assert.ifError(err);
          // jsonp errors should be returned with HTTP status 200
          assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
          assert.equal(res.body, 'test({"errors":["Layer 0 has no exposed attributes"]});');
          return null;
        },
        function do_get_attr_1(err)
        {
          assert.ifError(err);
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/' + expected_token + '/1/attributes/1',
              method: 'GET'
          }, {}, function(res, err) { next(err, res); });
        },
        function check_attr_1(err, res) {
          assert.ifError(err);
          assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
          var parsed = JSON.parse(res.body);
          assert.deepEqual(parsed, {"n":6});
          return null;
        },
        function finish(err) {
          var errors = [];
          if ( err ) {
              errors.push(''+err);
          }
          redis_client.exists("map_cfg|" +  expected_token, function(err/*, exists*/) {
              if ( err ) {
                  errors.push(err.message);
              }
              //assert.ok(exists, "Missing expected token " + expected_token + " from redis");
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

    // Test that you cannot write to the database from an attributes tile request
    //
    // Test for http://github.com/CartoDB/Windshaft/issues/130
    //
    it("database access is read-only", function(done) {

        // clone the mapconfig test
        var mapConfig = createMapConfig("select 1 as i, 6 as n, 'SRID=4326;POINT(0 0)'::geometry as the_geom," +
            " test_table_inserter(st_setsrid(st_point(0,0),4326),'write') as w", 'i', ['n', 'w']);

        var testClient = new TestClient(mapConfig);
        testClient.getFeatureAttributes(1, 1, function(err) {
            assert.ok(err);
            assert.equal(err.message, 'cannot execute INSERT in a read-only transaction');
            done();
        });

    });

});
