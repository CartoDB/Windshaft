'use strict';

require('../support/test_helper');

var assert = require('../support/assert');
var TestClient = require('../support/test_client');

describe('multilayer error cases', function () {
    it('layergroup with no cartocss_version', function (done) {
        var layergroup = {
            version: '1.0.0',
            layers: [
                {
                    options: {
                        sql: 'select cartodb_id, ST_Translate(the_geom, 50, 0) as the_geom from test_table limit 2',
                        cartocss: '#layer { marker-fill:red; marker-width:32; marker-allow-overlap:true; }'
                    }
                }
            ]
        };

        var testClient = new TestClient(layergroup);
        testClient.createLayergroup(function (err) {
            assert.ok(err);
            assert.equal(err.message, 'Missing cartocss_version for layer 0 options');
            done();
        });
    });

    it('sql/cartocss combination errors', function (done) {
        var layergroup = {
            version: '1.0.1',
            layers: [{
                options: {
                    sql: "select 1 as i, 'LINESTRING(0 0, 1 0)'::geometry as the_geom",
                    cartocss_version: '2.0.2',
                    cartocss: '#layer [missing=1] { line-width:16; }'
                }
            }]
        };
        var testClient = new TestClient(layergroup);
        testClient.createLayergroup(function (err) {
            assert.ok(err);
            assert.ok(err.message.match(/column "missing" does not exist/m));
            // cannot check for error starting with style0 until a new enough mapnik
            // is used: https://github.com/mapnik/mapnik/issues/1924
            // assert.ok(error.match(/^style0/), "Error doesn't start with style0: " + error);
            // TODO: check which layer introduced the problem ?
            done();
        });
    });

    it('sql/interactivity combination error', function (done) {
        var layergroup = {
            version: '1.0.1',
            layers: [
                {
                    options: {
                        sql: "select 1 as i, st_setsrid('LINESTRING(0 0, 1 0)'::geometry, 4326) as the_geom",
                        cartocss_version: '2.0.2',
                        cartocss: '#layer { line-width:16; }',
                        interactivity: 'i'
                    }
                },
                {
                    options: {
                        sql: "select 1 as i, st_setsrid('LINESTRING(0 0, 1 0)'::geometry, 4326) as the_geom",
                        cartocss_version: '2.0.2',
                        cartocss: '#layer { line-width:16; }'
                    }
                },
                {
                    options: {
                        sql: "select 1 as i, st_setsrid('LINESTRING(0 0, 1 0)'::geometry, 4326) as the_geom",
                        cartocss_version: '2.0.2',
                        cartocss: '#layer { line-width:16; }',
                        interactivity: 'missing'
                    }
                }
            ]
        };
        var testClient = new TestClient(layergroup);
        testClient.createLayergroup(function (err) {
            assert.ok(err);
            assert.ok(err.message.match(/column "missing" does not exist/m));
            // TODO: check which layer introduced the problem ?
            done();
        });
    });

    it('blank CartoCSS error', function (done) {
        var layergroup = {
            version: '1.0.1',
            layers: [
                {
                    options: {
                        sql: "select 1 as i, 'LINESTRING(0 0, 1 0)'::geometry as the_geom",
                        cartocss_version: '2.0.2',
                        cartocss: '#style { line-width:16 }',
                        interactivity: 'i'
                    }
                },
                {
                    options: {
                        sql: "select 1 as i, 'LINESTRING(0 0, 1 0)'::geometry as the_geom",
                        cartocss_version: '2.0.2',
                        cartocss: '',
                        interactivity: 'i'
                    }
                }
            ]
        };
        var testClient = new TestClient(layergroup);
        testClient.createLayergroup(function (err) {
            assert.ok(err);
            assert.ok(err.message.match(/^style1: CartoCSS is empty/));
            done();
        });
    });

    it('Invalid mapnik-geometry-type CartoCSS error', function (done) {
        var layergroup = {
            version: '1.0.1',
            layers: [
                {
                    options: {
                        sql: "select 1 as i, 'LINESTRING(0 0, 1 0)'::geometry as the_geom",
                        cartocss_version: '2.0.2',
                        cartocss: '#style [mapnik-geometry-type=bogus] { line-width:16 }'
                    }
                },
                {
                    options: {
                        sql: "select 1 as i, 'LINESTRING(0 0, 1 0)'::geometry as the_geom",
                        cartocss_version: '2.0.2',
                        cartocss: '#style [mapnik-geometry-type=bogus] { line-width:16 }'
                    }
                }
            ]
        };
        var testClient = new TestClient(layergroup);
        testClient.createLayergroup(function (err) {
            assert.ok(err);
            // carto-0.9.3 used to say "Failed to parse expression",
            // carto-0.9.5 says "not a valid keyword"
            assert.ok(err.message.match(/^style0:.*(Failed|not a valid)/));
            // TODO: check which layer introduced the problem ?
            done();
        });
    });

    it("post'ing style with non existent column (address) in filter returns 400 with error", function (done) {
        var layergroup = {
            version: '1.0.1',
            layers: [
                {
                    options: {
                        sql: 'select * from test_table limit 1',
                        cartocss: '#test_table::outline[address="one"], [address="two"] { marker-fill: red; }',
                        cartocss_version: '2.0.2',
                        interactivity: ['cartodb_id']
                    }
                },
                {
                    options: {
                        sql: 'select * from test_big_poly limit 1',
                        cartocss: '#test_big_poly { marker-fill:blue }',
                        cartocss_version: '2.0.2',
                        interactivity: ['cartodb_id']
                    }
                }
            ]
        };

        var testClient = new TestClient(layergroup);
        testClient.createLayergroup(function (err) {
            assert.ok(err);
            assert.ok(err.message.match(/column "address" does not exist/m));
            done();
        });
    });

    it("post'ing style with non existent column for its own layer in filter returns 400 with error", function (done) {
        var layergroup = {
            version: '1.0.1',
            layers: [
                {
                    options: {
                        sql: 'select * from test_table limit 1',
                        cartocss: '#test_table::outline[nonexistent="one"], [nonexistent="two"] { marker-fill: red; }',
                        cartocss_version: '2.0.2',
                        interactivity: ['cartodb_id']
                    }
                },
                {
                    options: {
                        sql: 'select * from test_big_poly limit 1',
                        cartocss: '#test_big_poly { marker-fill:blue }',
                        cartocss_version: '2.0.2',
                        interactivity: ['cartodb_id']
                    }
                }
            ]
        };

        var testClient = new TestClient(layergroup);
        testClient.createLayergroup(function (err) {
            assert.ok(err);
            assert.ok(err.message.match(/column "nonexistent" does not exist/m));
            assert.equal(err.layerIndex, 0);
            done();
        });
    });

    // See https://github.com/Vizzuality/Windshaft/issues/31
    it('bogus sql raises 400 status code', function (done) {
        var bogusSqlMapConfig = TestClient.singleLayerMapConfig('BOGUS FROM test_table');
        var testClient = new TestClient(bogusSqlMapConfig);
        testClient.createLayergroup(function (err) {
            assert.ok(err);
            assert.ok(/syntax error/.test(err.message), 'Unexpected error: ' + err.message);
            done();
        });
    });

    it('query with no geometry field returns 400 status', function (done) {
        var noGeometrySqlMapConfig = TestClient.singleLayerMapConfig('SELECT 1');
        var testClient = new TestClient(noGeometrySqlMapConfig);
        testClient.createLayergroup(function (err) {
            assert.ok(err);
            assert.ok(/column.*does not exist/.test(err.message), 'Unexpected error: ' + err.message);
            done();
        });
    });

    it('bogus style should raise 400 status', function (done) {
        var bogusStyleMapConfig = TestClient.defaultTableMapConfig('test_table', '#test_table{xxxxx;}');
        var testClient = new TestClient(bogusStyleMapConfig);
        testClient.createLayergroup(function (err) {
            assert.ok(err);
            assert.equal(err.message, 'style0:1:9 Invalid code: xxxxx;');
            done();
        });
    });

    it('should raise 400 error for out of bounds layer index', function (done) {
        var mapConfig = TestClient.singleLayerMapConfig('select * from test_table', null, null, 'name');
        var testClient = new TestClient(mapConfig);
        testClient.getTile(13, 4011, 3088, { layer: 1, format: 'grid.json' }, function (err) {
            assert.ok(err);
            assert.equal(err.message, "Layer '1' not found in layergroup");
            done();
        });
    });
});
