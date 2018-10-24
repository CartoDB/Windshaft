'use strict';

require('../support/test_helper');

const assert = require('../support/assert');
const TestClient = require('../support/test_client');
const mapnik = require('@carto/mapnik');

const describe_pg = process.env.POSTGIS_VERSION >= '20400' ? describe : describe.skip;

describe('mvt (mapnik)', () => { mvtTest(false); });
describe_pg('mvt (pgsql)', () => { mvtTest(true); });
describe_pg('Compare mvt renderers', () => { describe_compare_renderer(); });

function mvtTest(usePostGIS) {
    const options = { mvt: { usePostGIS: usePostGIS } };
    it('Error with table that does not exist', function (done) {
        const sql = 'select * from this_table_does_not_exist';
        const mapConfig = TestClient.mvtLayerMapConfig(sql, null, null, 'name');
        const testClient = new TestClient(mapConfig, options);

        testClient.getTile(13, 4011, 3088, { layer: 'mapnik', format: 'mvt' }, function (err) {
            assert.ok(err);
            assert.ok(err.toString().match('(.*)"this_table_does_not_exist" does not exist(.*)'));
            done();
        });
    });

    it('Works with columns with spaces', function (done) {
        const sql = 'SELECT 1 AS "cartodb id", ' +
                            "'SRID=3857;POINT(-293823 5022065)'::geometry as the_geom";
        const mapConfig = TestClient.mvtLayerMapConfig(sql, null, null, 'name');
        mapConfig.layers[0].options.geom_column = 'the_geom';
        mapConfig.layers[0].options.srid = 3857;

        const testClient = new TestClient(mapConfig, options);
        testClient.getTile(0, 0, 0, { format: 'mvt' }, function (err, mvtTile) {
            assert.ifError(err);

            const vtile = new mapnik.VectorTile(0, 0, 0);
            vtile.setData(mvtTile);
            const result = vtile.toJSON();

            assert.equal(result[0].features.length, 1);
            assert.strictEqual(result[0].features[0].properties["cartodb id"], 1);

            done();
        });
    });

    it('single layer', function (done) {
        const mapConfig = TestClient.mvtLayerMapConfig('select * from test_table', null, null, 'name');
        const testClient = new TestClient(mapConfig, options);

        testClient.getTile(13, 4011, 3088, { layer: 'mapnik', format: 'mvt' }, function (err, mvtTile) {
            assert.ifError(err);

            const vectorTile = new mapnik.VectorTile(13, 4011, 3088);

            vectorTile.setData(mvtTile);
            assert.equal(vectorTile.painted(), true);
            assert.equal(vectorTile.empty(), false);

            const result = vectorTile.toJSON();
            assert.equal(result.length, 1);

            const layer0 = result[0];
            assert.equal(layer0.name, 'layer0');
            assert.equal(layer0.features.length, 5);

            const expectedNames = ['Hawai', 'El Estocolmo', 'El Rey del Tallarín', 'El Lacón', 'El Pico'];
            const names = layer0.features.map(function (f) {
                return f.properties.name;
            });
            assert.deepEqual(names, expectedNames);

            assert.ok(layer0.features.every(feature => Object.keys(feature.properties).length === 3),
                    `Should contain the columns requested in the sql query as properties`);

            done();
        });
    });

    it('single layer and the query has a semicolon', function (done) {
        const sql = "select cartodb_id, the_geom_webmercator from test_table \n\t ;   ";
        const mapConfig = TestClient.mvtLayerMapConfig(sql, 'the_geom_webmercator', 3857);
        const testClient = new TestClient(mapConfig, options);

        testClient.getTile(13, 4011, 3088, { layer: 'mapnik', format: 'mvt' }, function (err, mvtTile) {
            if (err) {
                return done(err);
            }

            const vectorTile = new mapnik.VectorTile(13, 4011, 3088);

            vectorTile.setData(mvtTile);
            assert.equal(vectorTile.painted(), true);
            assert.equal(vectorTile.empty(), false);

            const result = vectorTile.toJSON();

            assert.equal(result.length, 1);

            done();
        });
    });

    it('single layer and the query retrieves `the_geom_webmercator` only', function (done) {
        if (!usePostGIS) {
            return done();
        }

        const sql = 'select the_geom_webmercator from test_table';
        const mapConfig = TestClient.mvtLayerMapConfig(sql, null, null, 'name');
        const testClient = new TestClient(mapConfig, options);

        testClient.getTile(13, 4011, 3088, { layer: 'mapnik', format: 'mvt' }, function (err, mvtTile) {
            if (err) {
                return done(err);
            }

            const vectorTile = new mapnik.VectorTile(13, 4011, 3088);

            vectorTile.setData(mvtTile);
            assert.equal(vectorTile.painted(), true);
            assert.equal(vectorTile.empty(), false);

            const result = vectorTile.toJSON();

            assert.equal(result.length, 1);

            done();
        });
    });

    it('Layer without sql', function (done) {
        const mapConfig = TestClient.singleLayerMapConfig('select * from test_table', null, null, 'name');
        delete mapConfig.layers[0].options.sql;
        const testClient = new TestClient(mapConfig, options);

        testClient.getTile(13, 4011, 3088, { layer: 'mapnik', format: 'mvt' }, function (err) {
            assert.ok(err);
            done();
        });
    });

    const multipleLayersMapConfig =  {
        version: '1.3.0',
        layers: [
            {
                type: 'mapnik',
                options: {
                    sql: 'select * from test_table limit 2',
                    cartocss: '#layer { marker-fill:red; marker-width:32; marker-allow-overlap:true; }',
                    cartocss_version: '2.3.0',
                    interactivity: ['name']
                }
            },
            {
                type: 'mapnik',
                options: {
                    sql: 'select * from test_table limit 3 offset 2',
                    cartocss: '#layer { marker-fill:blue; marker-allow-overlap:true; }',
                    cartocss_version: '2.3.0',
                    interactivity: ['name']
                }
            }
        ]
    };

    const mixedLayersMapConfig =  {
        version: '1.3.0',
        layers: [
            {
                type: 'plain',
                options: {
                    color: 'red',
                    interactivity: ['name']
                }
            },
            {
                type: 'mapnik',
                options: {
                    sql: 'select * from test_table limit 2',
                    cartocss: '#layer { marker-fill:red; marker-width:32; marker-allow-overlap:true; }',
                    cartocss_version: '2.3.0',
                    interactivity: ['name']
                }
            },
            {
                type: 'mapnik',
                options: {
                    sql: 'select * from test_table limit 3 offset 2',
                    cartocss: '#layer { marker-fill:blue; marker-allow-overlap:true; }',
                    cartocss_version: '2.3.0',
                    interactivity: ['name']
                }
            },
            {
                type: 'torque',
                options: {
                    sql: 'select * from test_table',
                    cartocss: [
                        'Map {',
                        ' -torque-frame-count:1;',
                        ' -torque-resolution:1;',
                        ' -torque-time-attribute:d;',
                        ' -torque-aggregation-function:"count(*)";',
                        '}',
                        '#layer { marker-fill:blue; }'
                    ].join('')
                }
            }
        ]
    };

    function multipleLayersValidation(done) {
        return function (err, mvtTile) {
            assert.ifError(err);

            const vtile = new mapnik.VectorTile(13, 4011, 3088);
            vtile.setData(mvtTile);
            assert.equal(vtile.painted(), true);
            assert.equal(vtile.empty(), false);

            const result = vtile.toJSON();
            assert.equal(result.length, 2);

            const layer0 = result[0];
            assert.equal(layer0.name, 'layer0');
            assert.equal(layer0.features.length, 2);

            const layer1 = result[1];
            assert.equal(layer1.name, 'layer1');
            assert.equal(layer1.features.length, 3);

            const layer0ExpectedNames = ['Hawai', 'El Estocolmo'];
            assert.deepEqual(layer0.features.map(function (f) {
                return f.properties.name;
            }), layer0ExpectedNames);
            const layer1ExpectedNames = ['El Rey del Tallarín', 'El Lacón', 'El Pico'];
            assert.deepEqual(layer1.features.map(function (f) {
                return f.properties.name;
            }), layer1ExpectedNames);

            assert.ok(layer0.features.every(feature => Object.keys(feature.properties).length === 3),
                    'Should contain the columns requested in the sql query as properties');
            assert.ok(layer1.features.every(feature => Object.keys(feature.properties).length === 3),
                    'Should contain the columns requested in the sql query as properties');

            done();
        };
    }

    it('multiple layers', function(done) {
        const testClient = new TestClient(multipleLayersMapConfig, options);
        testClient.getTile(13, 4011, 3088, { layer: 'mapnik', format: 'mvt'}, multipleLayersValidation(done));
    });

    it('multiple layers do not specify `mapnik` as layer, use undefined', function(done) {
        const testClient = new TestClient(multipleLayersMapConfig, options);
        testClient.getTile(13, 4011, 3088, { layer: undefined, format: 'mvt'}, multipleLayersValidation(done));
    });

    describe('multiple layers with other types', function() {

        it('happy case', function(done) {
            const testClient = new TestClient(mixedLayersMapConfig, options);
            testClient.getTile(13, 4011, 3088, { layer: 'mapnik', format: 'mvt'}, multipleLayersValidation(done));
        });

        it('invalid mvt layer', function(done) {
            const testClient = new TestClient(mixedLayersMapConfig, options);
            testClient.getTile(13, 4011, 3088, { layer: 0, format: 'mvt'}, function(err) {
                assert.ok(err);
                assert.equal(err.message, 'Unsupported format mvt');
                done();
            });
        });

        it('select one layer', function(done) {
            const testClient = new TestClient(mixedLayersMapConfig, options);
            testClient.getTile(13, 4011, 3088, { layer: 1, format: 'mvt'}, function (err, mvtTile) {
                assert.ifError(err);

                const vtile = new mapnik.VectorTile(13, 4011, 3088);
                vtile.setData(mvtTile);
                assert.equal(vtile.painted(), true);
                assert.equal(vtile.empty(), false);

                const result = vtile.toJSON();
                assert.equal(result.length, 1);

                const layer0 = result[0];
                assert.equal(layer0.name, 'layer0');
                assert.equal(layer0.features.length, 2);

                const layer0ExpectedNames = ['Hawai', 'El Estocolmo'];
                const names = layer0.features.map(function (f) { return f.properties.name; });
                assert.deepEqual(names, layer0ExpectedNames);

                assert.ok(layer0.features.every(feature => Object.keys(feature.properties).length === 3),
                        'Should contain the columns requested in the sql query as properties');

                done();
            });
        });

        it('select multiple mapnik layers', function(done) {
            const testClient = new TestClient(mixedLayersMapConfig, options);
            testClient.getTile(13, 4011, 3088, { layer: '1,2', format: 'mvt'}, multipleLayersValidation(done));
        });

        it('filter some mapnik layers', function(done) {
            const mapConfig =  {
                version: '1.3.0',
                layers: [
                    {
                        type: 'plain',
                        options: {
                            color: 'red'
                        }
                    },
                    {
                        type: 'mapnik',
                        options: {
                            sql: 'select * from test_table limit 2',
                            cartocss: '#layer { marker-fill:red; marker-width:32; marker-allow-overlap:true; }',
                            cartocss_version: '2.3.0',
                            interactivity: ['name']
                        }
                    },
                    {
                        type: 'mapnik',
                        options: {
                            sql: 'select * from test_table limit 3 offset 2',
                            cartocss: '#layer { marker-fill:blue; marker-allow-overlap:true; }',
                            cartocss_version: '2.3.0',
                            interactivity: ['name']
                        }
                    },
                    {
                        type: 'mapnik',
                        options: {
                            sql: 'select * from test_table',
                            cartocss: '#layer { marker-fill:red; marker-width:32; marker-allow-overlap:true; }',
                            cartocss_version: '2.3.0',
                            interactivity: ['name']
                        }
                    }
                ]
            };
            const testClient = new TestClient(mapConfig, options);
            testClient.getTile(13, 4011, 3088, { layer: '1,3', format: 'mvt'}, function (err, mvtTile) {
                assert.ifError(err);

                const vtile = new mapnik.VectorTile(13, 4011, 3088);
                vtile.setData(mvtTile);
                assert.equal(vtile.painted(), true);
                assert.equal(vtile.empty(), false);

                const result = vtile.toJSON();
                assert.equal(result.length, 2);

                const layer0 = result[0];
                assert.equal(layer0.name, 'layer0');
                assert.equal(layer0.features.length, 2);

                const layer1 = result[1];
                assert.equal(layer1.name, 'layer2');
                assert.equal(layer1.features.length, 5);

                const layer0ExpectedNames = ['Hawai', 'El Estocolmo'];
                assert.deepEqual(layer0.features.map(function (f) {
                    return f.properties.name;
                }), layer0ExpectedNames);

                const layer1ExpectedNames = ['Hawai', 'El Estocolmo', 'El Rey del Tallarín', 'El Lacón', 'El Pico'];
                assert.deepEqual(layer1.features.map(function (f) {
                    return f.properties.name;
                }), layer1ExpectedNames);

                assert.ok(layer0.features.every(feature => Object.keys(feature.properties).length === 3),
                        'Should contain the columns requested in the sql query as properties');
                assert.ok(layer1.features.every(feature => Object.keys(feature.properties).length === 3),
                        'Should contain the columns requested in the sql query as properties');

                done();
            });
        });

        //TODO test token substitution

        it('should be able to access layer names by layer id', function(done) {
            const mapConfig = {
                version: '1.3.0',
                layers: [
                    {
                        type: 'plain',
                        options: {
                            color: 'red'
                        }
                    },
                    {
                        id: "test-name",
                        type: 'mapnik',
                        options: {
                            sql: 'select * from test_table limit 2',
                            cartocss: '#layer { marker-fill:red; marker-width:32; marker-allow-overlap:true; }',
                            cartocss_version: '2.3.0',
                            interactivity: ['name']
                        }
                    },
                    {
                        type: 'mapnik',
                        options: {
                            sql: 'select * from test_table limit 3 offset 2',
                            cartocss: '#layer { marker-fill:blue; marker-allow-overlap:true; }',
                            cartocss_version: '2.3.0',
                            interactivity: ['name']
                        }
                    },
                    {
                        id: "test-name-top",
                        type: 'mapnik',
                        options: {
                            sql: 'select * from test_table',
                            cartocss: '#layer { marker-fill:red; marker-width:32; marker-allow-overlap:true; }',
                            cartocss_version: '2.3.0',
                            interactivity: ['name']
                        }
                    }
                ]
            };
            const testClient = new TestClient(mapConfig, options);
            testClient.getTile(13, 4011, 3088, { layer: 'mapnik', format: 'mvt'}, function (err, mvtTile) {
                assert.ifError(err);

                const vtile = new mapnik.VectorTile(13, 4011, 3088);
                vtile.setData(mvtTile);
                assert.equal(vtile.painted(), true);
                assert.equal(vtile.empty(), false);

                const result = vtile.toJSON();
                assert.equal(result.length, 3);

                const layer0 = result[0];
                assert.equal(layer0.name, 'test-name');
                assert.equal(layer0.features.length, 2);

                const layer1 = result[1];
                assert.equal(layer1.name, 'layer1');
                assert.equal(layer1.features.length, 3);

                const layer2 = result[2];
                assert.equal(layer2.name, 'test-name-top');
                assert.equal(layer2.features.length, 5);

                const layer0ExpectedNames = ['Hawai', 'El Estocolmo'];
                assert.deepEqual(layer0.features.map(function (f) {
                    return f.properties.name;
                }), layer0ExpectedNames);

                const layer1ExpectedNames = ['El Rey del Tallarín', 'El Lacón', 'El Pico'];
                assert.deepEqual(layer1.features.map(function (f) {
                    return f.properties.name;
                }), layer1ExpectedNames);

                const layer2ExpectedNames = ['Hawai', 'El Estocolmo', 'El Rey del Tallarín', 'El Lacón', 'El Pico'];
                assert.deepEqual(layer2.features.map(function (f) {
                    return f.properties.name;
                }), layer2ExpectedNames);

                assert.ok(layer0.features.every(feature => Object.keys(feature.properties).length === 3),
                        'Should contain the columns requested in the sql query as properties');
                assert.ok(layer1.features.every(feature => Object.keys(feature.properties).length === 3),
                        'Should contain the columns requested in the sql query as properties');
                assert.ok(layer2.features.every(feature => Object.keys(feature.properties).length === 3),
                        'Should contain the columns requested in the sql query as properties');

                done();
            });
        });
    });

    describe('respects data types', function () {

        const SQL = [
            {   name    : "[bool, int]",
                sql     : "SELECT 1 AS cartodb_id, ST_SetSRID(ST_MakePoint(-71.10434, 42.315),4326)" +
                            " AS the_geom, FALSE as status2, 0 as data"
            },
            {
                name    : "[int, bool]",
                sql     : "SELECT 1 AS cartodb_id, ST_SetSRID(ST_MakePoint(-71.10434, 42.315),4326)" +
                            " AS the_geom, 0 as data, FALSE as status2"
                }
        ];
        const mapConfig = {
            version: '1.7.0',
            layers: [
                {
                    type: 'cartodb',
                    options: {
                        geom_column: 'the_geom'
                    }
                }
            ]
        };

        SQL.forEach(function(tuple){
            it('bool and int iteration ' + tuple.name, function (done) {
                mapConfig.layers[0].options.sql = tuple.sql;
                const testClient = new TestClient(mapConfig, options);
                testClient.getTile(0, 0, 0, { format: 'mvt' }, function (err, mvtTile) {
                    assert.ifError(err);

                    const vtile = new mapnik.VectorTile(0, 0, 0);
                    vtile.setData(mvtTile);
                    const result = vtile.toJSON();

                    const layer0 = result[0];
                    assert.equal(layer0.features.length, 1);
                    assert.strictEqual(layer0.features[0].properties.status2, false);
                    assert.strictEqual(layer0.features[0].properties.data, 0);

                    done();
                });
            });
        });
    });

    describe('`vector_extent` & `vector_simplify_extent`', function() {

        [256, 666, 1024, 2222, 4096, 10000, 4096 * Math.pow(2,18)]
        .forEach(size => {
            it('Works with both as '+ size, function (done) {
                const sql = 'SELECT ' + size + ' AS "cartodb_id", ' +
                                    "'SRID=3857;LINESTRING(-293823 5022065, 3374847 8386059)'::geometry as the_geom";
                const mapConfig = TestClient.mvtLayerMapConfig(sql, null, null, 'name');
                mapConfig.layers[0].options.geom_column = 'the_geom';
                mapConfig.layers[0].options.srid = 3857;
                mapConfig.layers[0].options.vector_extent = size;
                mapConfig.layers[0].options.vector_simplify_extent = size;
                const testClient = new TestClient(mapConfig, options);
                testClient.getTile(0, 0, 0, { format: 'mvt' }, function (err, mvtTile) {
                    assert.ifError(err);

                    const vtile = new mapnik.VectorTile(0, 0, 0);
                    vtile.setData(mvtTile);
                    const result = vtile.toJSON();
                    assert.equal(result[0].extent, size);
                    assert.equal(result[0].features.length, 1);
                    assert.equal(result[0].features[0].properties.cartodb_id, size);

                    done();
                });
            });
        });

        [0, Math.pow(2,31), 'Huracán']
        .forEach(size => {
            it('Extent fails with ' + size, function (done) {
                const mapConfig = {
                    version: '1.8.0',
                    layers: [
                        {
                            type: 'mapnik',
                            options: {
                                geom_column: 'the_geom',
                                srid: 3857,
                                sql: 'SELECT 1 AS "cartodb_id", ' +
                                     "'SRID=3857;POINT(-293823 5022065)'::geometry as the_geom",
                                vector_extent: size
                            }
                        }
                    ]
                };

                const testClient = new TestClient(mapConfig, options);
                testClient.getTile(0, 0, 0, { format: 'mvt' }, function (err) {
                    assert.notEqual(err, undefined);
                    done();
                });
            });

            it('Simplify fails with ' + size, function (done) {
                const mapConfig = {
                    version: '1.8.0',
                    layers: [
                        {
                            type: 'mapnik',
                            options: {
                                geom_column: 'the_geom',
                                srid: 3857,
                                sql: 'SELECT 1 AS "cartodb_id", ' +
                                     "'SRID=3857;POINT(-293823 5022065)'::geometry as the_geom",
                                vector_extent: 4096,
                                vector_simplify_extent : size
                            }
                        }
                    ]
                };

                const testClient = new TestClient(mapConfig, options);
                testClient.getTile(0, 0, 0, { format: 'mvt' }, function (err) {
                    assert.notEqual(err, undefined);
                    done();
                });
            });
        });

        it('Fails with vector_simplify_extent > vector_extent', function (done) {
            const mapConfig = {
                version: '1.8.0',
                layers: [
                    {
                        type: 'mapnik',
                        options: {
                            geom_column: 'the_geom',
                            srid: 3857,
                            sql: 'SELECT 1 AS "cartodb_id", ' +
                                 "'SRID=3857;POINT(-293823 5022065)'::geometry as the_geom",
                            vector_extent: 4096,
                            vector_simplify_extent : 4200
                        }
                    }
                ]
            };

            const testClient = new TestClient(mapConfig, options);
            testClient.getTile(0, 0, 0, { format: 'mvt' }, function (err) {
                assert.notEqual(err, undefined);
                done();
            });
        });

        it('Fails with multiple vector_extent in the mapConfig', function (done) {
            const mapConfig = {
                version: '1.8.0',
                layers: [
                    {
                        type: 'mapnik',
                        options: {
                            geom_column: 'the_geom',
                            srid: 3857,
                            sql: 'SELECT 1 AS "cartodb_id", ' +
                                 "'SRID=3857;POINT(-293823 5022065)'::geometry as the_geom",
                            vector_extent: 666
                        }
                    },
                    {
                        type: 'mapnik',
                        options: {
                            geom_column: 'the_geom',
                            srid: 3857,
                            sql: 'SELECT 4 AS "cartodb_id", ' +
                                 "'SRID=3857;POINT(-293823 5022065)'::geometry as the_geom",
                            vector_extent: 777
                        }
                    }
                ]
            };

            const testClient = new TestClient(mapConfig, options);
            testClient.getTile(0, 0, 0, { format: 'mvt' }, function (err) {
                assert.notEqual(err, undefined);
                done();
            });
        });

        it('Fails with multiple vector_simplify_extent in the mapConfig', function (done) {
            const mapConfig = {
                version: '1.8.0',
                layers: [
                    {
                        type: 'mapnik',
                        options: {
                            geom_column: 'the_geom',
                            srid: 3857,
                            sql: 'SELECT 1 AS "cartodb_id", ' +
                                 "'SRID=3857;POINT(-293823 5022065)'::geometry as the_geom",
                            vector_simplify_extent: 666
                        }
                    },
                    {
                        type: 'mapnik',
                        options: {
                            geom_column: 'the_geom',
                            srid: 3857,
                            sql: 'SELECT 4 AS "cartodb_id", ' +
                                 "'SRID=3857;POINT(-293823 5022065)'::geometry as the_geom",
                            vector_simplify_extent: 777
                        }
                    }
                ]
            };

            const testClient = new TestClient(mapConfig, options);
            testClient.getTile(0, 0, 0, { format: 'mvt' }, function (err) {
                assert.notEqual(err, undefined);
                done();
            });
        });

        it('Fails with multiple vector_extent in the mapConfig (888 and default [4096])', function (done) {
            const mapConfig = {
                version: '1.8.0',
                layers: [
                    {
                        type: 'mapnik',
                        options: {
                            geom_column: 'the_geom',
                            srid: 3857,
                            sql: 'SELECT 1 AS "cartodb_id", ' +
                                 "'SRID=3857;POINT(-293823 5022065)'::geometry as the_geom",
                            vector_extent: 888
                        }
                    },
                    {
                        type: 'mapnik',
                        options: {
                            geom_column: 'the_geom',
                            srid: 3857,
                            sql: 'SELECT 4 AS "cartodb_id", ' +
                                 "'SRID=3857;POINT(-293823 5022065)'::geometry as the_geom"
                        }
                    }
                ]
            };

            const testClient = new TestClient(mapConfig, options);
            testClient.getTile(0, 0, 0, { format: 'mvt' }, function (err) {
                assert.notEqual(err, undefined);
                done();
            });
        });

        it('Fails with multiple vector_simplify_extent in the mapConfig (888 and default [256])', function (done) {
            const mapConfig = {
                version: '1.8.0',
                layers: [
                    {
                        type: 'mapnik',
                        options: {
                            geom_column: 'the_geom',
                            srid: 3857,
                            sql: 'SELECT 1 AS "cartodb_id", ' +
                                 "'SRID=3857;POINT(-293823 5022065)'::geometry as the_geom",
                            vector_simplify_extent: 888
                        }
                    },
                    {
                        type: 'mapnik',
                        options: {
                            geom_column: 'the_geom',
                            srid: 3857,
                            sql: 'SELECT 4 AS "cartodb_id", ' +
                                 "'SRID=3857;POINT(-293823 5022065)'::geometry as the_geom"
                        }
                    }
                ]
            };

            const testClient = new TestClient(mapConfig, options);
            testClient.getTile(0, 0, 0, { format: 'mvt' }, function (err) {
                assert.notEqual(err, undefined);
                done();
            });
        });

        it('Fails with multiple vector_simplify_extent (888 and default [vector_extent])', function (done) {
            const mapConfig = {
                version: '1.8.0',
                layers: [
                    {
                        type: 'mapnik',
                        options: {
                            geom_column: 'the_geom',
                            srid: 3857,
                            sql: 'SELECT 1 AS "cartodb_id", ' +
                                 "'SRID=3857;POINT(-293823 5022065)'::geometry as the_geom",
                            vector_simplify_extent: 888
                        }
                    },
                    {
                        type: 'mapnik',
                        options: {
                            geom_column: 'the_geom',
                            srid: 3857,
                            sql: 'SELECT 4 AS "cartodb_id", ' +
                                 "'SRID=3857;POINT(-293823 5022065)'::geometry as the_geom",
                            vector_extent: 512
                        }
                    }
                ]
            };

            const testClient = new TestClient(mapConfig, options);
            testClient.getTile(0, 0, 0, { format: 'mvt' }, function (err) {
                assert.notEqual(err, undefined);
                done();
            });
        });

        it('Works with equivalent vector_extent (4096 and default [4096])', function (done) {
            const mapConfig = {
                version: '1.8.0',
                layers: [
                    {
                        type: 'mapnik',
                        options: {
                            geom_column: 'the_geom',
                            srid: 3857,
                            sql: 'SELECT 1 AS "cartodb_id", ' +
                                 "'SRID=3857;POINT(-293823 5022065)'::geometry as the_geom",
                            vector_extent: 4096,
                            vector_simplify_extent: 256
                        }
                    },
                    {
                        type: 'mapnik',
                        options: {
                            geom_column: 'the_geom',
                            srid: 3857,
                            sql: 'SELECT 4 AS "cartodb_id", ' +
                                 "'SRID=3857;POINT(-293823 5022065)'::geometry as the_geom",
                            vector_simplify_extent: 256
                        }
                    }
                ]
            };

            const testClient = new TestClient(mapConfig, options);
            testClient.getTile(0, 0, 0, { format: 'mvt' }, function (err, mvtTile) {
                assert.ifError(err);

                const vtile = new mapnik.VectorTile(0, 0, 0);
                vtile.setData(mvtTile);
                const result = vtile.toJSON();
                assert.equal(result[0].extent, 4096);
                assert.equal(result[0].features.length, 1);
                assert.equal(result[0].features[0].properties.cartodb_id, 1);

                done();
            });
        });

        it('Works with equivalent vector_simplify_extent (256 and default [256])', function (done) {
            const mapConfig = {
                version: '1.8.0',
                layers: [
                    {
                        type: 'mapnik',
                        options: {
                            geom_column: 'the_geom',
                            srid: 3857,
                            sql: 'SELECT 1 AS "cartodb_id", ' +
                                 "'SRID=3857;POINT(-293823 5022065)'::geometry as the_geom",
                            vector_simplify_extent: 256
                        }
                    },
                    {
                        type: 'mapnik',
                        options: {
                            geom_column: 'the_geom',
                            srid: 3857,
                            sql: 'SELECT 4 AS "cartodb_id", ' +
                                 "'SRID=3857;POINT(-293823 5022065)'::geometry as the_geom"
                        }
                    }
                ]
            };

            const testClient = new TestClient(mapConfig, options);
            testClient.getTile(0, 0, 0, { format: 'mvt' }, function (err) {
                assert.ifError(err);
                done();
            });
        });

        it('Works with equivalent vector_simplify_extent (666 and default [vector_simplify])', function (done) {
            const mapConfig = {
                version: '1.8.0',
                layers: [
                    {
                        type: 'mapnik',
                        options: {
                            geom_column: 'the_geom',
                            srid: 3857,
                            sql: 'SELECT 1 AS "cartodb_id", ' +
                                 "'SRID=3857;POINT(-293823 5022065)'::geometry as the_geom",
                            vector_extent: 666,
                            vector_simplify_extent: 666
                        }
                    },
                    {
                        type: 'mapnik',
                        options: {
                            geom_column: 'the_geom',
                            srid: 3857,
                            sql: 'SELECT 4 AS "cartodb_id", ' +
                                 "'SRID=3857;POINT(-293823 5022065)'::geometry as the_geom",
                            vector_extent: 666
                        }
                    }
                ]
            };

            const testClient = new TestClient(mapConfig, options);
            testClient.getTile(0, 0, 0, { format: 'mvt' }, function (err) {
                assert.ifError(err);
                done();
            });
        });

        it('vector_simplify_extent simplifies as requested', function (done) {
            // Tolerance (256): 78271.51758 = Earth radius / 256 / 2
            // Tolerance (4096): 4891.969849 = Earth radius / 4096 / 2
            const mapConfigOriginal = {
                version: '1.8.0',
                layers: [{
                        type: 'mapnik',
                        options: {
                            geom_column: 'the_geom',
                            srid: 3857,
                            sql: 'SELECT 1 AS "cartodb_id", ' +
                                 "'SRID=3857;" +
                                 "LINESTRING(0 5000, 0 10000, 0 15000, 0 20000, 0 25000, 0 30000, 0 35000, 0 40000," +
                                 "0 45000, 0 50000, 0 55000, 0 60000, 0 65000, 0 70000, 0 750000, 0 80000)'" +
                                 "::geometry as the_geom",
                            vector_extent: 4096,
                            vector_simplify_extent: 256
                        }
                    }]
            };

            const mapConfigPresimplified = {
                version: '1.8.0',
                layers: [{
                        type: 'mapnik',
                        options: {
                            geom_column: 'the_geom',
                            srid: 3857,
                            sql: 'SELECT 1 AS "cartodb_id", ' +
                                 "St_Simplify(ST_RemoveRepeatedPoints(" +
                                 "'SRID=3857;" +
                                 "LINESTRING(0 5000, 0 10000, 0 15000, 0 20000, 0 25000, 0 30000, 0 35000, 0 40000," +
                                 "0 45000, 0 50000, 0 55000, 0 60000, 0 65000, 0 70000, 0 750000, 0 80000)'" +
                                 "::geometry, 78271.51758), 78271.51758, true) as the_geom",
                            vector_extent: 4096,
                            vector_simplify_extent: 4096
                        }
                    }]
            };

            const testClient = new TestClient(mapConfigOriginal, options);
            testClient.getTile(0, 0, 0, { format: 'mvt' }, function (err, mvtOriginal) {
                assert.ifError(err);
                const testClientSimplified = new TestClient(mapConfigPresimplified, options);
                testClientSimplified.getTile(0, 0, 0, { format: 'mvt' }, function (err, mvtSimple) {
                    assert.ifError(err);
                    mvt_cmp(mvtOriginal, mvtSimple);

                    // For Mapnik compare again using TWKB this time
                    if (usePostGIS) {
                        done();
                    } else {
                        const optionsTWKB = {
                            mvt: {
                                usePostGIS: false
                            },
                            mapnik: { grainstore : { datasource : {
                                "twkb_encoding": true
                            }}}
                        };

                        const testClientTWKB = new TestClient(mapConfigOriginal, optionsTWKB);
                        testClientTWKB.getTile(0, 0, 0, { format: 'mvt' }, function (err, mvtOriginalTWKB) {
                            assert.ifError(err);
                            const testClientSimpleTWKB = new TestClient(mapConfigPresimplified, optionsTWKB);
                            testClientSimpleTWKB.getTile(0, 0, 0, { format: 'mvt' }, function (err, mvtSimpleTWKB) {
                                assert.ifError(err);
                                mvt_cmp(mvtOriginalTWKB, mvtSimpleTWKB);
                                done();
                            });
                        });
                    }
                });
            });
        });
    });
}

function mvtInteger(parameterInteger) {
    return ((parameterInteger >> 1) ^ (-(parameterInteger & 1)));
}

// This is a very basic decoder to be able to compare 2 geometries
// Currently it just extracts the declared points of a geometry, without
// considering at all its type (or the finishing point of a polygon)
function mvtExtractComponents(geometry) {
    let points = [ { x : 0, y : 0 } ];
    let cmd_points = 0;
    for (let i = 0; i < geometry.length; i++) {
        if (cmd_points === 0) {
            // Read the next command and extract the number of points pending
            if (geometry[i] === 15) {
                // Ignore ClosePath
                continue;
            }
            cmd_points = geometry[i] >> 3;
        } else {
            cmd_points--;
            // The point coordinates are in relation to the previous one
            points.push({
                x : mvtInteger(geometry[i]) + points[points.length - 1].x,
                y : mvtInteger(geometry[++i]) + points[points.length - 1].y
            });
        }
    }

    return points.slice(1).sort((p1, p2) => {
        return (p1.x > p2.x) || ((p1.x === p2.x) && (p1.y > p2.y));
    });
}

// Compares (with a tolerance of +- 2) an array of points
function mvtPointArray_cmp(arr1, arr2) {
    arr1 = arr1.filter(p1 => !arr2.find(p2 => Math.abs(p1.x - p2.x) <= 2 && Math.abs(p1.y - p2.y) <= 2));
    assert.equal(arr1.length, 0, "Items not found in Mapnik's: " + JSON.stringify(arr1));
}

// Check if 2 MVT features are equivalent
// Does not compare feature.id since it's optional (Mapnik sets it, St_AsMVT doesn't)
function mvtFeature_cmp(feature1, feature2) {
    assert.equal(feature1.type, feature2.type);
    assert.deepEqual(feature1.properties, feature2.properties);

    assert.equal(feature1.geometry.length, feature2.geometry.length,
        (feature1.geometry.length > feature2.geometry.length ? "Mapnik's" : "Postgres'") +
                " feature has a geometry made of more points");
    const f1_points = mvtExtractComponents(feature1.geometry);
    const f2_points = mvtExtractComponents(feature2.geometry);

    mvtPointArray_cmp(f1_points, f2_points);
}

// Check if 2 MVT layers are equivalent
function mvtLayer_cmp(layer1, layer2) {
    assert.equal(layer1.name, layer2.name);
    assert.equal(layer1.version, layer2.version);
    assert.equal(layer1.extent, layer2.extent);

    if (!layer1.features) {
        assert.ifError(layer2.features);
        return;
    }

    assert.equal(layer1.features.length, layer2.features.length,
        (layer1.features.length > layer2.features.length ? "Mapnik" : "Postgres") +
                " layer has more features");

    layer1.features.forEach(f1 => {
        // We look for a feature with the same cartodb_id as the order isn't guaranteed
        assert.ok(f1.properties && f1.properties.cartodb_id,
                "Comparison requires properties with cartodb_id. Got: " + JSON.stringify(f1));
        let f2 = layer2.features.find(feature => f1.properties.cartodb_id === feature.properties.cartodb_id);
        assert.ok(f2, "Could not find feature with cartodb_id '" + f1.properties.cartodb_id +  "'");
        mvtFeature_cmp(f1, f2);
    });
}


// Check if 2 MVT tiles are equivalent
function mvt_cmp(tileData1, tileData2) {
    let vtile1 = new mapnik.VectorTile(0, 0, 0);
    vtile1.setData(tileData1);

    let vtile2 = new mapnik.VectorTile(0, 0, 0);
    vtile2.setData(tileData2);

    // Check emptyness to shortcircuit if needed
    if (vtile1.empty()) {
        assert.ok(vtile2.empty());
        return;
    }

    // Both should be equaly invalid
    let valid = vtile1.reportGeometryValiditySync();
    let valid2 = vtile2.reportGeometryValiditySync();
    if (valid && !valid2) {
        assert.equal(valid.length, 0, "Mapnik: Found invalid geometries: " + JSON.stringify(valid));
    } else if (!valid && valid2) {
        assert.equal(valid2.length, 0, "Postgis: Found invalid geometries: " + JSON.stringify(valid));
    }

    // Layer (number, name, size)
    const t1 = vtile1.toJSON();
    const t2 = vtile2.toJSON();
    assert.equal(t1.length, t2.length,
        (t1.length > t2.length ? "Mapnik" : "Postgres") + " tile has more layers");

    t1.forEach(layer1 => {
        // We look for a layer with the same name as the order isn't guaranteed
        let layer2 = t2.find(layer => layer.name === layer1.name);
        assert.ok(layer2, "Could not find layer named '" + layer1.name + "'");
        mvtLayer_cmp(layer1, layer2);
    });

}


// Compares the output returned by both renderers (mapnik and pg_mvt) given the same input
function describe_compare_renderer() {

    const LAYER_TESTS = [
        {
            name: 'Single layer',
            tile : { z : 13, x: 4011, y: 3088 },
            mapConfig : {
                version: '1.7.0',
                layers: [
                    {
                        type: 'mapnik',
                        options: {
                            sql: 'select * from test_table'
                        }
                    }
                ]
            }
        },
        {
            name: 'Multiple layers',
            tile : { z : 13, x: 4011, y: 3088 },
            mapConfig : {
                version: '1.7.0',
                layers: [
                    {
                        type: 'mapnik',
                        options: {
                            sql: 'select * from test_table limit 2'
                        }
                    },
                    {
                        type: 'mapnik',
                        options: {
                            sql: 'select * from test_table limit 3 offset 2'
                        }
                    }
                ]
            }
        },
        {
            name: 'Single layer - Repeated rows',
            tile : { z : 13, x: 4011, y: 3088 },
            mapConfig : {
                version: '1.7.0',
                layers: [
                    {
                        type: 'mapnik',
                        options: {
                            sql: 'Select * from test_table UNION ALL Select * from test_table '
                        }
                    }
                ]
            }
        }
    ];

    LAYER_TESTS.forEach(test => {
        it(test.name, function (done) {

            const mapnikOptions = {
                mvt : {
                    usePostGIS: false
                }
            };

            const pgOptions = {
                mvt : {
                    usePostGIS: true
                }
            };

            const testClientMapnik = new TestClient(test.mapConfig, mapnikOptions);
            const testClientPg_mvt = new TestClient(test.mapConfig, pgOptions);

            const tileOptions = { format : 'mvt' };
            const z = test.tile && test.tile.z ? test.tile.z : 0;
            const x = test.tile && test.tile.x ? test.tile.x : 0;
            const y = test.tile && test.tile.y ? test.tile.y : 0;

            testClientMapnik.getTile(z, x, y, tileOptions, function (err1, mapnikMVT, img, mheaders) {
                testClientPg_mvt.getTile(z, x, y, tileOptions, function (err2, pgMVT, img, pheaders) {
                    assert.ifError(err1);
                    assert.ifError(err2);
                    assert.deepEqual(mheaders, pheaders);
                    if (mheaders['x-tilelive-contains-data']) {
                        mvt_cmp(mapnikMVT, pgMVT);
                    }

                    done();
                });
            });
        });
    });


    const GEOM_TESTS = [
        {
            name: 'Null geometry',
            sql: "SELECT 2 AS cartodb_id, null as the_geom"
        },
        {
            name: 'Empty tile',
            tile : { z : 18, x: 0, y: 0 },
            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"POINT(-293823 5022065)" +
"'::geometry as the_geom"
        },
        {
            name: 'Point',
            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"POINT(-293823 5022065)" +
"'::geometry as the_geom"
        },
        {
            name: 'Multipoint',
            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"MULTIPOINT(-293823 5022065, 3374847 8386059)" +
"'::geometry as the_geom"
        },
        {
            name: 'Multipoint (repeated consecutive)',
            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"MULTIPOINT(-293823 5022065, -293823 5022065, -293823 5022065)" +
"'::geometry as the_geom"
        },
        {
            name: 'Multipoint (repeated non consecutive)',
            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"MULTIPOINT(-293823 5022065, 3374847 8386059, -293823 5022065, -293823 5022065)" +
"'::geometry as the_geom"
        },
        {
            name: 'Linestring',
            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"LINESTRING(-293823 5022065, 3374847 8386059)" +
"'::geometry as the_geom"
        },
        {
            name: 'Linestring (zero length)',
            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"LINESTRING(-293823 5022065, -293823 5022065)" +
"'::geometry as the_geom"
        },
        {
            name: 'Linestring (repeated points)',
            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"LINESTRING(-293823 5022065, 3374847 8386059, 3374847 8386059)" +
"'::geometry as the_geom"
        },
        {
            name: 'Linestring (simplify connected segments)',
            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"LINESTRING(0 20037508, 0 0, 0 10037508, 0 -10037508, 0 -20037508)" +
"'::geometry as the_geom",
            tile : { z : 12, x: 12, y: 12 },
        },
        {
            name: 'Linestring (join segments)',
            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"LINESTRING(0 20037508, 0 0, 0 -20037508)" +
"'::geometry as the_geom"
        },
        {
            name: 'Multilinestring',
            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"MULTILINESTRING((-293823 5022065, 3374847 8386059),(-293823 5022065, -1917652 9627396))" +
"'::geometry as the_geom"
        },
        {
            name: 'Multilinestring (zero length)',
            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"MULTILINESTRING((-293823 5022065, -293823 5022065),(-293823 5022065, -1917652 9627396))" +
"'::geometry as the_geom"
        },
        {
            name: 'Multilinestring (simplify duplicated lines)',
            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"MULTILINESTRING((-293823 5022065, -1917652 9627396),(-293823 5022065, -1917652 9627396))" +
"'::geometry as the_geom"
        },
        {
            name: 'Polygon (CW)',
            tile : { z : 0, x: 0, y: 0 },
            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"POLYGON((-20037508 20037508, 20037508 20037508, 20037508 -20037508, -20037508 -20037508, -20037508 20037508))" +
"'::geometry as the_geom"
        },
        {
            name: 'Polygon (CCW)',
            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"POLYGON((-20037508 20037508, -20037508 -20037508, 20037508 -20037508, 20037508 20037508, -20037508 20037508))" +
"'::geometry as the_geom"
        },
        {
            name: 'Polygon (CW - CW)',
            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"POLYGON((-20037508 20037508, 20037508 20037508, 20037508 -20037508, -20037508 -20037508, -20037508 20037508)," +
"(-18037508 18037508, 18037508 18037508, 18037508 -18037508, -18037508 -18037508, -18037508 18037508))" +
"'::geometry as the_geom"
        },
        {
            name: 'Polygon (CW - CCW)',
            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"POLYGON((-20037508 20037508, 20037508 20037508, 20037508 -20037508, -20037508 -20037508, -20037508 20037508)," +
"(-18037508 18037508, -18037508 -18037508, 18037508 -18037508, 18037508 18037508, -18037508 18037508))" +
"'::geometry as the_geom"
        },
        {
            name: 'Polygon (CCW - CW)',
            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"POLYGON((-20037508 20037508, -20037508 -20037508, 20037508 -20037508, 20037508 20037508, -20037508 20037508)," +
"(-18037508 18037508, 18037508 18037508, 18037508 -18037508, -18037508 -18037508, -18037508 18037508))" +
"'::geometry as the_geom"
        },
        {
            name: 'Polygon (CCW - CCW)',
            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"POLYGON((-20037508 20037508, -20037508 -20037508, 20037508 -20037508, 20037508 20037508, -20037508 20037508)," +
"(-18037508 18037508, -18037508 -18037508, 18037508 -18037508, 18037508 18037508, -18037508 18037508))" +
"'::geometry as the_geom"
        },
        {
            name: 'Polygon (CW - CW - CW - CW)',
            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"POLYGON((-20037508 20037508, 20037508 20037508, 20037508 -20037508, -20037508 -20037508, -20037508 20037508)," +
"(-18037508 18037508, 18037508 18037508, 18037508 -18037508, -18037508 -18037508, -18037508 18037508)," +
"(-16037508 16037508, 16037508 16037508, 16037508 -16037508, -16037508 -16037508, -16037508 16037508)," +
"(-14037508 14037508, 14037508 14037508, 14037508 -14037508, -14037508 -14037508, -14037508 14037508))" +
"'::geometry as the_geom",
            knownIssue : "Mapnik drops extra inner rings"
        },
        {
            name: 'Polygon (CCW - CCW - CCW - CCW)',
            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"POLYGON((-20037508 20037508, -20037508 -20037508, 20037508 -20037508, 20037508 20037508, -20037508 20037508)," +
"(-18037508 18037508, -18037508 -18037508, 18037508 -18037508, 18037508 18037508, -18037508 18037508)," +
"(-16037508 16037508, -16037508 -16037508, 16037508 -16037508, 16037508 16037508, -16037508 16037508)," +
"(-14037508 14037508, -14037508 -14037508, 14037508 -14037508, 14037508 14037508, -14037508 14037508))" +
"'::geometry as the_geom",
            knownIssue : "Mapnik drops extra inner rings"
        },
        {
            name: 'Polygon (Duplicates drops to 3 points)',
            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"POLYGON((-20037508 20037508, 20037508 -20037508, 20037508 -20037508, 20037508 -20037508, -20037508 20037508))" +
"'::geometry as the_geom"
        },
        {
            name: 'Polygon (Duplicates but still valid)',
            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"POLYGON((-20037508 20037508, 20037508 20037508, 20037508 -20037508, 20037508 -20037508, -20037508 20037508))" +
"'::geometry as the_geom"
        },
        {
            name: 'Polygon (Simplify)',
            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"POLYGON((-20037508 20037508, 20037508 20037508, 20037508 0, 20000000 0, 19985435 -500, 20037508 -500, " +
"20037508 -20037508,-20037508 -20037508,-20037508 20037508))" +
"'::geometry as the_geom",
            knownIssue : "Postgis does not fully simplify the geometry"
        },
        {
            name: 'Polygon (Join segments)',
            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"POLYGON((-20037508 20037508, 20037508 20037508, 20037508 0, 20037508 -20037508, " +
"-20037508 -20037508, -20037508 20037508))" +
"'::geometry as the_geom"
        },
        {
            name: 'Polygon (Area equal to zero [Line])',
            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"POLYGON((-20037508 20037508, -20037508 4037508, -20037508 0,-20037508 -4037508, " +
"-20037508 -20037508, -20037508 20037508))" +
"'::geometry as the_geom",
            knownIssue : "Postgis does not fully simplify the geometry (should be empty)"
        },
        {
            name: 'Polygon (Area equal to zero [Ext ring == Internal ring])',
            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"POLYGON((-20037508 20037508, 20037508 20037508, 20037508 -20037508, -20037508 -20037508, -20037508 20037508), " +
"(-20037508 20037508, -20037508 -20037508, 20037508 -20037508, 20037508 20037508, -20037508 20037508))" +
"'::geometry as the_geom",
            knownIssue : "Postgis does not fully simplify the geometry (should be empty)"
        },
        {
            name: 'Polygon (Area equal to zero [All points equal])',
            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"POLYGON((-20037508 20037508, -20037508 20037508, -20037508 20037508, -20037508 20037508, " +
"-20037508 20037508, -20037508 20037508))" +
"'::geometry as the_geom"
        },
        {
            name: 'Polygon (Self intersection)',
            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"POLYGON((20037508 20037508, -20037508 -20037508, 20037508 -20037508, -20037508 20037508, 20037508 20037508))" +
"'::geometry as the_geom",
            knownIssue : "Mapnik drops the geometry completely"
        },
        {
            name: 'Polygon (Self tangency)',
            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"POLYGON((-20037508 20037508,20037508 20037508,20037508 0,0 0,0 20037508,-20037508 0,-20037508 20037508))" +
"'::geometry as the_geom"
        },
        {
            name: 'Multipolygon',
            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"MULTIPOLYGON(((-20037508 20037508, 0 20037508, 0 -20037508, -20037508 -20037508, -20037508 20037508)),"+
"((10000 16037508, 16037508 16037508, 16037508 -16037508, 10000 -16037508, 10000 16037508)))" +
"'::geometry as the_geom"
        },
        {
            name: 'Multipolygon (Intersect)',
            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"MULTIPOLYGON(((-20037508 20037508, 20037508 20037508, 20037508 -20037508, -20037508 -20037508, -20037508 20037508)),"+
"((-16037508 16037508, 16037508 16037508, 16037508 -16037508, -16037508 -16037508, -16037508 16037508)))" +
"'::geometry as the_geom"
        },
        {
            name: 'Multipolygon (Tangent)',
            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"MULTIPOLYGON(((-20037508 20037508, 0 20037508, 0 -20037508, -20037508 -20037508, -20037508 20037508)),"+
"((0 16037508, 16037508 16037508, 16037508 -16037508, 0 -16037508, 0 16037508)))" +
"'::geometry as the_geom",
            knownIssue : "Mapnik doesn't join them into one"
        },
        {
            name: 'Multipolygon (Repeated)',
            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"MULTIPOLYGON(((-20037508 20037508, 20037508 20037508, 20037508 -20037508, -20037508 -20037508, -20037508 20037508)),"+
"((-20037508 20037508, 20037508 20037508, 20037508 -20037508, -20037508 -20037508, -20037508 20037508)))" +
"'::geometry as the_geom",
            knownIssue : "Mapnik doesn't remove the extra"
        },
        {
            name: 'Geometrycollection (Homogeneous)',
            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"GEOMETRYCOLLECTION(POINT(-14037508 14037508), POINT(-20037508 20037508))" +
"'::geometry as the_geom",
            knownIssue : "Mapnik uses multiple features. Postgis casts it to multipoint"
        },
        {
            name: 'Geometrycollection (Heterogeneous)',
            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;GEOMETRYCOLLECTION(" +
"POLYGON((-14037508 14037508, 14037508 14037508, 14037508 -14037508, -14037508 -14037508, -14037508 14037508)), " +
"LINESTRING(-20037508 20037508, 20037508 20037508), POINT(0 0)" +
")'::geometry as the_geom",
            knownIssue : "Mapnik uses multiple features. Postgis drops the line"
        },
        {
            name: 'Equivalent simplification',
            tile : { z : 8, x: 127, y: 95 },
            sql:
"SELECT '" +
"MULTILINESTRING((" +
"-190773.334640355 4986284.45337084,-190771.715102263 4986283.13231332,-190767.939953676 4986279.09976568," +
"-190762.461517777 4986272.72137811,-190755.771292106 4986264.34694711,-190748.375244109 4986254.32065266," +
"-190740.790896642 4986242.98167782,-190733.853135184 4986231.4256399,-190720.318376913 4986207.76231744," +
"-190712.971208273 4986196.06033632,-190705.795179 4986185.53747932,-190685.851007018 4986158.32430334," +
"-190679.465900889 4986149.2249286,-190673.472775019 4986139.96887625,-190668.055663137 4986130.48253339," +
"-190663.559676438 4986121.29441797,-190655.051739436 4986102.72286473,-190650.094263293 4986093.04972464," +
"-190639.653328894 4986073.90945103,-190634.658500513 4986064.24704415,-190625.930623411 4986045.74733144," +
"-190621.229877404 4986036.62926981,-190614.851744666 4986026.21528448,-190607.690668732 4986016.11136282," +
"-190599.952715869 4986006.23573456,-190591.795080852 4985996.52671364,-190574.662389955 4985977.44101632," +
"-190547.894016291 4985949.32535537,-190520.512672672 4985921.83007923,-190501.924504294 4985904.18901056," +
"-190492.468589953 4985895.74844397,-190482.852549151 4985887.68806805,-190473.020599439 4985880.13930275," +
"-190462.900445826 4985873.2704264,-190436.304658346 4985857.76559638,-190426.200511031 4985850.88871842," +
"-190416.392964168 4985843.32862396,-190406.808662836 4985835.25397645,-190397.390761974 4985826.79671236," +
"-190388.09460054 4985818.05900047,-190369.741374494 4985800.03467653,-190333.474428502 4985762.96822981," +
"-190188.759592077 4985613.45168872,-190170.873503461 4985594.70522849,-190153.379002083 4985575.80476361," +
"-190144.89665405 4985566.24933463,-190136.688362864 4985556.58493602,-190128.856763244 4985546.7705535," +
"-190121.535824516 4985536.75265148,-190114.897621642 4985526.46249081,-190100.017557678 4985499.46310066," +
"-190093.537394287 4985489.34411495,-190086.428304963 4985479.4755338,-190078.876708329 4985469.78273236," +
"-190055.130698237 4985441.1340689,-190047.343688138 4985431.53081291,-190039.889969018 4985421.79349919," +
"-190032.970036454 4985411.84148826,-190026.83071188 4985401.5764096,-190021.778965938 4985390.87560875," +
"-190018.13553587 4985379.96392709,-190015.472801189 4985368.65880427,-190013.439308376 4985357.1006577," +
"-190010.030958944 4985333.71656641,-190008.066177675 4985322.12727935,-190005.506964234 4985310.77645019," +
"-190001.983245204 4985299.8145511,-189997.041174914 4985289.07492709,-189990.966332379 4985278.80388664," +
"-189984.035517174 4985268.90204282,-189976.459197029 4985259.30175488,-189968.392498125 4985249.96477327," +
"-189959.944860073 4985240.88092489,-189951.186082965 4985232.06979251,-189942.15209488 4985223.58344988," +
"-189932.845774305 4985215.51336376,-189923.238834072 4985207.99691413,-189913.09178484 4985201.09176465," +
"-189891.804256594 4985188.42835604,-189880.25687236 4985181.21490215,-189868.124789728 4985172.73613682," +
"-189856.496116557 4985163.78358654,-189845.714632381 4985154.8544578,-189836.125895049 4985146.44147802," +
"-189821.934801087 4985133.08649598," +"-189818.054529627 4985129.07872948," +"-189816.829604027 4985127.43227191))" +
"'::geometry as the_geom, 61374 as cartodb_id",
            knownIssue : "Mapnik uses a different formula for simplification to adapt to TWKB grid"
        },
        {
            name: 'Polygon - Extent 256',
            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"POLYGON((-20037508 20037508, 20037508 20037508, 20037508 -20037508, -20037508 -20037508, -20037508 20037508)," +
"(-18037508 18037508, -18037508 -18037508, 18037508 -18037508, 18037508 18037508, -18037508 18037508))" +
"'::geometry as the_geom",
            vector_extent : 256,
            vector_simplify_extent : 256
        },
        {
            name: 'Polygon - Extent 1024',
            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"POLYGON((-20037508 20037508, 20037508 20037508, 20037508 -20037508, -20037508 -20037508, -20037508 20037508)," +
"(-18037508 18037508, -18037508 -18037508, 18037508 -18037508, 18037508 18037508, -18037508 18037508))" +
"'::geometry as the_geom",
            vector_extent : 1024,
            vector_simplify_extent : 1024
        },
        {
            name: 'One tile optimization',
            sql:
"SELECT '" +
"MULTILINESTRING((" +
"-190773.334640355 4986284.45337084,-190771.715102263 4986283.13231332,-190767.939953676 4986279.09976568," +
"-190762.461517777 4986272.72137811,-190755.771292106 4986264.34694711,-190748.375244109 4986254.32065266," +
"-190740.790896642 4986242.98167782,-190733.853135184 4986231.4256399,-190720.318376913 4986207.76231744," +
"-190712.971208273 4986196.06033632,-190705.795179 4986185.53747932,-190685.851007018 4986158.32430334," +
"-190679.465900889 4986149.2249286,-190673.472775019 4986139.96887625,-190668.055663137 4986130.48253339," +
"-190663.559676438 4986121.29441797,-190655.051739436 4986102.72286473,-190650.094263293 4986093.04972464," +
"-190639.653328894 4986073.90945103,-190634.658500513 4986064.24704415,-190625.930623411 4986045.74733144," +
"-190621.229877404 4986036.62926981,-190614.851744666 4986026.21528448,-190607.690668732 4986016.11136282," +
"-190599.952715869 4986006.23573456,-190591.795080852 4985996.52671364,-190574.662389955 4985977.44101632," +
"-190547.894016291 4985949.32535537,-190520.512672672 4985921.83007923,-190501.924504294 4985904.18901056," +
"-190492.468589953 4985895.74844397,-190482.852549151 4985887.68806805,-190473.020599439 4985880.13930275," +
"-190462.900445826 4985873.2704264,-190436.304658346 4985857.76559638,-190426.200511031 4985850.88871842," +
"-190416.392964168 4985843.32862396,-190406.808662836 4985835.25397645,-190397.390761974 4985826.79671236," +
"-190388.09460054 4985818.05900047,-190369.741374494 4985800.03467653,-190333.474428502 4985762.96822981," +
"-190188.759592077 4985613.45168872,-190170.873503461 4985594.70522849,-190153.379002083 4985575.80476361," +
"-190144.89665405 4985566.24933463,-190136.688362864 4985556.58493602,-190128.856763244 4985546.7705535," +
"-190121.535824516 4985536.75265148,-190114.897621642 4985526.46249081,-190100.017557678 4985499.46310066," +
"-190093.537394287 4985489.34411495,-190086.428304963 4985479.4755338,-190078.876708329 4985469.78273236," +
"-190055.130698237 4985441.1340689,-190047.343688138 4985431.53081291,-190039.889969018 4985421.79349919," +
"-190032.970036454 4985411.84148826,-190026.83071188 4985401.5764096,-190021.778965938 4985390.87560875," +
"-190018.13553587 4985379.96392709,-190015.472801189 4985368.65880427,-190013.439308376 4985357.1006577," +
"-190010.030958944 4985333.71656641,-190008.066177675 4985322.12727935,-190005.506964234 4985310.77645019," +
"-190001.983245204 4985299.8145511,-189997.041174914 4985289.07492709,-189990.966332379 4985278.80388664," +
"-189984.035517174 4985268.90204282,-189976.459197029 4985259.30175488,-189968.392498125 4985249.96477327," +
"-189959.944860073 4985240.88092489,-189951.186082965 4985232.06979251,-189942.15209488 4985223.58344988," +
"-189932.845774305 4985215.51336376,-189923.238834072 4985207.99691413,-189913.09178484 4985201.09176465," +
"-189891.804256594 4985188.42835604,-189880.25687236 4985181.21490215,-189868.124789728 4985172.73613682," +
"-189856.496116557 4985163.78358654,-189845.714632381 4985154.8544578,-189836.125895049 4985146.44147802," +
"-189821.934801087 4985133.08649598," +"-189818.054529627 4985129.07872948," +"-189816.829604027 4985127.43227191))" +
"'::geometry as the_geom, 61374 as cartodb_id",
            tile : { z : 0, x: 0, y: 0 },
            vector_extent : Math.pow(2, 30),
            vector_simplify_extent : Math.pow(2, 30)
        },
        {
            name: "!bbox! includes geometries in the buffer zone",
            tile : { z: 12, x : 1204, y: 1540 },
            sql :
"SELECT cartodb_id, St_Transform(tg, 3857) as the_geom FROM ( " +
"SELECT 2 AS cartodb_id, 'SRID=3857;POINT(-8247459.53332372 4959086.55819354)'::geometry as tg " +
") _a WHERE tg && !bbox!"
        },
        {
            name: "Works correctly with buffer size 0",
            tile : { z: 12, x : 1204, y: 1540 },
            sql :
"SELECT cartodb_id, St_Transform(tg, 3857) as the_geom FROM ( " +
"SELECT 2 AS cartodb_id, 'SRID=3857;POINT(-8247459.53332372 4959086.55819354)'::geometry as tg " +
") _a ",
            bufferSize : 0
        }
    ];

    function setTestDefaults(test) {
        test.vector_extent = test.hasOwnProperty('vector_extent') ? test.vector_extent : 4096;
        test.vector_simplify_extent = test.hasOwnProperty('vector_simplify_extent') ?
                test.vector_simplify_extent : 4096;
        test.tile = Object.assign({ x : 0, y : 0, z : 0}, test.tile || {});
        test.bufferSize = test.hasOwnProperty('bufferSize') ? test.bufferSize : 64;
    }

    GEOM_TESTS.forEach(test => {
        (test.knownIssue ? it.skip : it)(test.name, function (done) {
            setTestDefaults(test);

            const mapConfig = {
                version: '1.7.0',
                buffersize: { 'mvt': test.bufferSize },
                layers: [
                    {
                        type: 'mapnik',
                        options: {
                            geom_column: 'the_geom',
                            srid: 3857,
                            sql: test.sql,
                            vector_extent : test.vector_extent,
                            vector_simplify_extent : test.vector_simplify_extent
                        }
                    }
                ]
            };

            const mapnikOptions = {
                mvt: {
                    usePostGIS: false
                },
                mapnik: { grainstore : { datasource : {
                    "row_limit":0,
                    "persist_connection": false,
                    "use_overviews": true,
                    "max_size": 500,
                    "twkb_encoding": true
                }}}
            };

            const pgOptions = {
                mvt : {
                    usePostGIS: true
                }
            };

            const testClientMapnik = new TestClient(mapConfig, mapnikOptions);
            const testClientPg_mvt = new TestClient(mapConfig, pgOptions);
            const tileOptions = { format : 'mvt' };
            const z = test.tile.z;
            const x = test.tile.x;
            const y = test.tile.y;

            testClientMapnik.getTile(z, x, y, tileOptions, function (err1, mapnikMVT, img, mheaders) {
                testClientPg_mvt.getTile(z, x, y, tileOptions, function (err2, pgMVT, img, pheaders) {
                    assert.ifError(err1);
                    assert.ifError(err2);
                    assert.deepEqual(mheaders, pheaders);
                    if (mheaders['x-tilelive-contains-data']) {
                        mvt_cmp(mapnikMVT, pgMVT);
                    }

                    done();
                });
            });
        });
    });


}
