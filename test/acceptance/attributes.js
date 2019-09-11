'use strict';

require('../support/test_helper');

var assert        = require('../support/assert');
var TestClient = require('../support/test_client');

describe('attributes', function() {

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
                        sql: sql || "SELECT * FROM (" +
                                "(SELECT 1 as i, 6 as n, 'SRID=4326;POINT(0 0)'::geometry as the_geom) UNION ALL " +
                                "(SELECT 2 as i, 6 as n, 'SRID=4326;POINT(0 0)'::geometry as the_geom) UNION ALL " +
                                "(SELECT 2 as i, 6 as n, 'SRID=4326;POINT(0 3)'::geometry as the_geom)) _a1",
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
            assert.ifError(err);
            assert.deepEqual(attributes, { n: 6 });
            done();
        });

    });


    it("can be fetched with json_agg column", function(done) {
        var sql = "SELECT 1 as i, 6 as n, 'SRID=4326;POINT(0 0)'::geometry as the_geom, " +
                  "json_agg(row_to_json((SELECT r FROM (SELECT 1 as d, 'Samuel' as name) r),true)) as data";
        var testClient = new TestClient(createMapConfig(sql, 'i', ['n', 'data']));
        testClient.getFeatureAttributes(ATTRIBUTES_LAYER, 1, function (err, attributes) {
            assert.ifError(err);
            assert.deepEqual(attributes, { n: 6, data: [ { d: 1, name: 'Samuel' } ] });
            done();
        });
    });

    it("can be fetched with duplicated id if as all attributes are the same ", function(done) {

        var testClient = new TestClient(createMapConfig());
        testClient.getFeatureAttributes(ATTRIBUTES_LAYER, 2, function (err, attributes) {
            assert.ifError(err);
            assert.deepEqual(attributes, { n: 6 });
            done();
        });

    });

    it("can be fetched with duplicated id if as all attributes are the same with json_agg", function(done) {

        var sql = "SELECT 1 as i, 6 as n, 'SRID=4326;POINT(0 0)'::geometry as the_geom, " +
                  "json_agg(row_to_json((SELECT r FROM (SELECT 1 as d, 'Samuel' as name) r),true)) as data " +
                  "UNION ALL " +
                  "SELECT 1 as i, 6 as n, 'SRID=4326;POINT(0 0)'::geometry as the_geom, " +
                  "json_agg(row_to_json((SELECT r FROM (SELECT 1 as d, 'Samuel' as name) r),true)) as data";

        var testClient = new TestClient(createMapConfig(sql, 'i', ['n', 'data']));
        testClient.getFeatureAttributes(ATTRIBUTES_LAYER, 1, function (err, attributes) {
            assert.ifError(err);
            assert.deepEqual(attributes, { n: 6, data: [ { d: 1, name: 'Samuel' } ] });
            done();
        });
    });

    it("cannot be fetched with duplicated id if not all attributes are the same ", function(done) {

        var testClient = new TestClient(createMapConfig(null, null, ['the_geom']));
        testClient.getFeatureAttributes(ATTRIBUTES_LAYER, 2, function (err) {
            assert.ok(err);
            assert.equal(err.message, "Multiple features (2) identified by 'i' = 2 in layer 1");
            done();
        });

    });

    it("cannot fetch attributes for non-existent feature id", function(done) {

        var testClient = new TestClient(createMapConfig());
        testClient.getFeatureAttributes(ATTRIBUTES_LAYER, -666, function (err) {
            assert.ok(err);
            assert.equal(err.message, "Multiple features (0) identified by 'i' = -666 in layer 1");
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

    it('can have mapnik substitution tokens', function(done) {
        var substitutionTokenSql = [
            "SELECT",
            "    1 as i,",
            "    !scale_denominator! as scale_denominator,",
            "    !pixel_width! as pixel_width,",
            "    !pixel_height! as pixel_height,",
            "    6 as n,",
            "    'SRID=4326;POINT(0 0)'::geometry as the_geom"
        ].join('\n');

        var expectedAttributes = {
            scale_denominator: '559082264.0287178',
            pixel_width: '156543.03392804097',
            pixel_height: '156543.03392804097',
            n: 6
        };

        var testClient = new TestClient(createMapConfig(substitutionTokenSql, 'i', Object.keys(expectedAttributes)));
        testClient.getFeatureAttributes(ATTRIBUTES_LAYER, 1, function (err, attributes) {
            assert.ifError(err);
            assert.deepEqual(attributes, expectedAttributes);
            done();
        });
    });
});
