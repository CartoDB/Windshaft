'use strict';

require('../support/test_helper');

var assert = require('../support/assert');
var TestClient = require('../support/test_client');

describe('torque', function () {
    function createTorqueMapConfig (cartoCss) {
        return {
            version: '1.1.0',
            layers: [
                {
                    type: 'torque',
                    options: {
                        sql: 'select cartodb_id, the_geom from test_table',
                        geom_column: 'the_geom',
                        srid: 4326,
                        cartocss: cartoCss
                    }
                }
            ]
        };
    }

    it('missing required property `-torque-frame-count` from torque layer', function (done) {
        var testClient = new TestClient(createTorqueMapConfig('Map { marker-fill:blue; }'));
        testClient.createLayergroup(function (err) {
            assert.ok(err);
            assert.equal(err.message, "Missing required property '-torque-frame-count' in torque layer CartoCSS");
            done();
        });
    });

    it('missing required property `-torque-resolution` from torque layer', function (done) {
        var testClient = new TestClient(createTorqueMapConfig('Map { -torque-frame-count: 2; }'));
        testClient.createLayergroup(function (err) {
            assert.ok(err);
            assert.equal(err.message, "Missing required property '-torque-resolution' in torque layer CartoCSS");
            done();
        });
    });

    it('missing required property `-torque-aggregation-function` from torque layer', function (done) {
        var testClient = new TestClient(
            createTorqueMapConfig('Map { -torque-frame-count: 2; -torque-resolution: 3; }')
        );
        testClient.createLayergroup(function (err) {
            assert.ok(err);
            assert.equal(
                err.message,
                "Missing required property '-torque-aggregation-function' in torque layer CartoCSS"
            );
            done();
        });
    });

    // See http://github.com/CartoDB/Windshaft/issues/150
    it('unquoted property in torque layer', function (done) {
        var layergroup = {
            version: '1.1.0',
            layers: [
                {
                    type: 'torque',
                    options: {
                        sql: 'select updated_at as d, cartodb_id as id, the_geom from test_table',
                        geom_column: 'the_geom',
                        srid: 4326,
                        cartocss: 'Map { -torque-frame-count:2; -torque-resolution:3; -torque-time-attribute:"d"; ' +
                   '-torque-aggregation-function:count(id); }'
                    }
                }
            ]
        };
        var testClient = new TestClient(layergroup);
        testClient.createLayergroup(function (err) {
            assert.ok(err);
            assert.equal(err.message, "Unexpected type for property '-torque-aggregation-function', expected string");
            done();
        });
    });

    var validTorqueMapConfig = {
        version: '1.1.0',
        layers: [
            {
                type: 'torque',
                options: {
                    sql: "select 1 as id, '1970-01-02'::date as d, 'POINT(0 0)'::geometry as the_geom UNION ALL " +
                     "select 2, '1970-01-01'::date, 'POINT(1 1)'::geometry",
                    geom_column: 'the_geom',
                    cartocss: 'Map { -torque-frame-count:2; -torque-resolution:3; -torque-time-attribute:d; ' +
                    '-torque-aggregation-function:\'count(id)\'; }',
                    cartocss_version: '2.0.1'
                }
            }
        ]
    };

    it('should create a layergroup for valid mapconfig', function (done) {
        var testClient = new TestClient(validTorqueMapConfig);
        testClient.createLayergroup(function (err, layergroup) {
            assert.ifError(err);
            assert.equal(layergroup.metadata.layers.length, 1);
            var meta = layergroup.metadata;
            assert.ok(meta, 'No metadata in torque MapConfig creation response: ' + layergroup);
            var tm = meta.torque;
            assert.ok(tm, 'No "torque" in metadata:' + JSON.stringify(meta));
            var tm0 = tm[0];
            assert.ok(tm0, 'No layer 0 in "torque" in metadata:' + JSON.stringify(tm));
            var expectedTorqueMetadata = {
                start: 0,
                end: 86400000,
                steps: 2,
                data_steps: 2,
                column_type: 'date',
                cartocss: ['Map {' +
                    ' -torque-frame-count:2;' +
                    ' -torque-resolution:3;' +
                    ' -torque-time-attribute:d;' +
                    " -torque-aggregation-function:'count(id)';" +
                ' }'].join('')
            };

            assert.deepEqual(tm0, expectedTorqueMetadata);
            assert.deepEqual(meta.layers[0].meta, expectedTorqueMetadata);

            done();
        });
    });

    ['torque.json', 'json.torque'].forEach(function (format) {
        it('should render a torque tile for valid mapconfig, format=' + format, function (done) {
            var expectedTorqueTileAt000 = [
                {
                    x__uint8: 43,
                    y__uint8: 43,
                    vals__uint8: [1, 1],
                    dates__uint16: [0, 1]
                }
            ];

            var testClient = new TestClient(validTorqueMapConfig);
            testClient.getTile(0, 0, 0, { layer: 0, format: format }, function (err, torqueTile) {
                assert.ifError(err);
                assert.deepEqual(torqueTile, expectedTorqueTileAt000);
                done();
            });
        });
    });

    it('should fail for undefined layer', function (done) {
        var testClient = new TestClient(validTorqueMapConfig);
        testClient.getTile(0, 0, 0, { layer: undefined }, function (err) {
            assert.ok(err);
            assert.equal(err.message, "No 'mapnik' layers in MapConfig");
            done();
        });
    });

    it('should fails for grid.json format', function (done) {
        var testClient = new TestClient(validTorqueMapConfig);
        testClient.getTile(0, 0, 0, { layer: 0, format: 'grid.json' }, function (err) {
            assert.ok(err);
            assert.equal(err.message, 'Unsupported format grid.json');
            done();
        });
    });

    // Test that you cannot write to the database from a torque tile request
    //
    // Test for http://github.com/CartoDB/Windshaft/issues/130
    //
    it('database access is read-only', function (done) {
        var mapconfig = {
            version: '1.1.0',
            layers: [
                {
                    type: 'torque',
                    options: {
                        sql: "select 'SRID=3857;POINT(0 0)'::geometry as g, now() as d,* from " +
                   "test_table_inserter(st_setsrid(st_point(0,0),4326),'write')",
                        geom_column: 'g',
                        cartocss: 'Map { -torque-frame-count:2; -torque-resolution:3; -torque-time-attribute:d; ' +
                   '-torque-aggregation-function:\'count(*)\'; }',
                        cartocss_version: '2.0.1'
                    }
                }
            ]
        };
        var testClient = new TestClient(mapconfig);
        testClient.createLayergroup(function (err) {
            assert.ok(err);
            assert.equal(err.message, 'TorqueRenderer: cannot execute INSERT in a read-only transaction');
            done();
        });
    });

    // See http://github.com/CartoDB/Windshaft/issues/164
    it('gives a 500 on database connection refused', function (done) {
        var mapconfig = {
            version: '1.1.0',
            layers: [
                {
                    type: 'torque',
                    options: {
                        sql: "select 1 as id, '1970-01-03'::date as d, 'POINT(0 0)'::geometry as the_geom UNION ALL select 2, " +
                   "'1970-01-01'::date, 'POINT(1 1)'::geometry",
                        geom_column: 'the_geom',
                        cartocss: 'Map { -torque-frame-count:2; -torque-resolution:3; -torque-time-attribute:d; ' +
                   '-torque-aggregation-function:\'count(id)\'; }',
                        cartocss_version: '2.0.1'
                    }
                }
            ]
        };

        var testClient = new TestClient(mapconfig);
        testClient.createLayergroup({ dbport: 54777 }, function (err) {
            assert.ok(err);
            assert.equal(err.message, 'TorqueRenderer: cannot connect to the database');
            done();
        });
    });

    it('checks types for torque-specific styles', function (done) {
        var wrongStyle = ['Map {',
            '-torque-frame-count:512;',
            '-torque-animation-duration:30;',
            "-torque-time-attribute:'cartodb_id';",
            '-torque-aggregation-function:count(cartodb_id);', // unquoted aggregation function
            '-torque-resolution:4;',
            '-torque-data-aggregation:linear;',
            '}'].join(' ');
        var layergroup = {
            version: '1.1.0',
            layers: [
                {
                    type: 'torque',
                    options: {
                        sql: 'select cartodb_id, the_geom from test_table',
                        geom_column: 'the_geom',
                        srid: 4326,
                        cartocss: wrongStyle
                    }
                }
            ]
        };

        var testClient = new TestClient(layergroup);
        testClient.createLayergroup(function (err) {
            assert.ok(err);
            assert.equal(err.message, "Unexpected type for property '-torque-aggregation-function', expected string");
            done();
        });
    });

    it('query can hold substitution tokens', function (done) {
        var tokens = ['bbox', 'scale_denominator', 'pixel_width', 'pixel_height'].map(function (token) {
            return '!' + token + '! as ' + token;
        });

        var sql = 'select *, ' + tokens.join(', ') + ' from test_table';

        var mapConfig = {
            version: '1.1.0',
            layers: [
                {
                    type: 'torque',
                    options: {
                        sql: sql,
                        geom_column: 'the_geom',
                        cartocss: 'Map {' +
                            '-torque-frame-count:2;' +
                            '-torque-resolution:1;' +
                            '-torque-time-attribute:cartodb_id;' +
                            '-torque-aggregation-function:\'count(cartodb_id)\';' +
                            '}',
                        cartocss_version: '2.0.1'
                    }
                }
            ]
        };

        var testClient = new TestClient(mapConfig);
        testClient.getTile(0, 0, 0, { layer: 0, format: 'torque.json' }, function (err, torqueTile) {
            assert.ifError(err);
            assert.equal(torqueTile[0].x__uint8, 128);
            assert.equal(torqueTile[0].y__uint8, 128);
            assert.ok(torqueTile[0].dates__uint16[0] === (torqueTile[0].vals__uint8[0] === 2 ? 1 : 0));
            assert.ok(torqueTile[0].dates__uint16[1] === (torqueTile[0].vals__uint8[1] === 2 ? 1 : 0));

            done();
        });
    });
});
