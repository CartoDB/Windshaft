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
    it("are checked at map creation time", function(done) {
        var mapconfig = createMapConfig('SELECT * FROM test_table', 'unexistant', ['cartodb_id']);
        var testClient = new TestClient(mapconfig);
        testClient.createLayergroup(function(err) {
            assert.ok(err);
            assert.equal(err.message, 'column "unexistant" does not exist');
            done();
        });
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
