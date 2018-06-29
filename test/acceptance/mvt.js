require('../support/test_helper');

var assert = require('../support/assert');
var TestClient = require('../support/test_client');
var mapnik = require('@carto/mapnik');

const describe_pg = process.env.POSTGIS_VERSION >= '20400' ? describe : describe.skip;

describe('mvt (mapnik)', () => { mvtTest(false); });
describe_pg('mvt (pgsql)', () => { mvtTest(true); });
describe_pg('Compare mvt renderers', () => { describe_compare_renderer(); });

function mvtTest(usePostGIS) {
    const options = { mvt: { usePostGIS: usePostGIS } };
    it('single layer', function (done) {
        var mapConfig = TestClient.singleLayerMapConfig('select * from test_table', null, null, 'name');
        var testClient = new TestClient(mapConfig, options);

        testClient.getTile(13, 4011, 3088, { layer: 'mapnik', format: 'mvt' }, function (err, mvtTile) {
            assert.ifError(err);

            var vectorTile = new mapnik.VectorTile(13, 4011, 3088);

            vectorTile.setData(mvtTile);
            assert.equal(vectorTile.painted(), true);
            assert.equal(vectorTile.empty(), false);

            var result = vectorTile.toJSON();
            assert.equal(result.length, 1);

            var layer0 = result[0];
            assert.equal(layer0.name, 'layer0');
            assert.equal(layer0.features.length, 5);

            var expectedNames = ['Hawai', 'El Estocolmo', 'El Rey del Tallarín', 'El Lacón', 'El Pico'];
            var names = layer0.features.map(function (f) {
                return f.properties.name;
            });
            assert.deepEqual(names, expectedNames);

            assert.ok(layer0.features.every(feature => Object.keys(feature.properties).length === 3),
                    `Should contain the columns requested in the sql query as properties`);

            done();
        });
    });

    // Should work with custom geom column

    var multipleLayersMapConfig =  {
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

    var mixedLayersMapConfig =  {
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
            assert.ok(!err, err);

            var vtile = new mapnik.VectorTile(13, 4011, 3088);
            vtile.setData(mvtTile);
            assert.equal(vtile.painted(), true);
            assert.equal(vtile.empty(), false);

            var result = vtile.toJSON();
            assert.equal(result.length, 2);

            var layer0 = result[0];
            assert.equal(layer0.name, 'layer0');
            assert.equal(layer0.features.length, 2);

            var layer1 = result[1];
            assert.equal(layer1.name, 'layer1');
            assert.equal(layer1.features.length, 3);

            var layer0ExpectedNames = ['Hawai', 'El Estocolmo'];
            assert.deepEqual(layer0.features.map(function (f) {
                return f.properties.name;
            }), layer0ExpectedNames);
            var layer1ExpectedNames = ['El Rey del Tallarín', 'El Lacón', 'El Pico'];
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
        var testClient = new TestClient(multipleLayersMapConfig, options);
        testClient.getTile(13, 4011, 3088, { layer: 'mapnik', format: 'mvt'}, multipleLayersValidation(done));
    });

    it('multiple layers do not specify `mapnik` as layer, use undefined', function(done) {
        var testClient = new TestClient(multipleLayersMapConfig, options);
        testClient.getTile(13, 4011, 3088, { layer: undefined, format: 'mvt'}, multipleLayersValidation(done));
    });

    describe('multiple layers with other types', function() {

        it('happy case', function(done) {
            var testClient = new TestClient(mixedLayersMapConfig, options);
            testClient.getTile(13, 4011, 3088, { layer: 'mapnik', format: 'mvt'}, multipleLayersValidation(done));
        });

        it('invalid mvt layer', function(done) {
            var testClient = new TestClient(mixedLayersMapConfig, options);
            testClient.getTile(13, 4011, 3088, { layer: 0, format: 'mvt'}, function(err) {
                assert.ok(err);
                assert.equal(err.message, 'Unsupported format mvt');
                done();
            });
        });

        it('select one layer', function(done) {
            var testClient = new TestClient(mixedLayersMapConfig, options);
            testClient.getTile(13, 4011, 3088, { layer: 1, format: 'mvt'}, function (err, mvtTile) {
                assert.ok(!err, err);

                var vtile = new mapnik.VectorTile(13, 4011, 3088);
                vtile.setData(mvtTile);
                assert.equal(vtile.painted(), true);
                assert.equal(vtile.empty(), false);

                var result = vtile.toJSON();
                assert.equal(result.length, 1);

                var layer0 = result[0];
                assert.equal(layer0.name, 'layer0');
                assert.equal(layer0.features.length, 2);

                var layer0ExpectedNames = ['Hawai', 'El Estocolmo'];
                var names = layer0.features.map(function (f) { return f.properties.name; });
                assert.deepEqual(names, layer0ExpectedNames);

                assert.ok(layer0.features.every(feature => Object.keys(feature.properties).length === 3),
                        'Should contain the columns requested in the sql query as properties');

                done();
            });
        });

        it('select multiple mapnik layers', function(done) {
            var testClient = new TestClient(mixedLayersMapConfig, options);
            testClient.getTile(13, 4011, 3088, { layer: '1,2', format: 'mvt'}, multipleLayersValidation(done));
        });

        it('filter some mapnik layers', function(done) {
            var mapConfig =  {
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
            var testClient = new TestClient(mapConfig, options);
            testClient.getTile(13, 4011, 3088, { layer: '1,3', format: 'mvt'}, function (err, mvtTile) {
                assert.ok(!err, err);

                var vtile = new mapnik.VectorTile(13, 4011, 3088);
                vtile.setData(mvtTile);
                assert.equal(vtile.painted(), true);
                assert.equal(vtile.empty(), false);

                var result = vtile.toJSON();
                assert.equal(result.length, 2);

                var layer0 = result[0];
                assert.equal(layer0.name, 'layer0');
                assert.equal(layer0.features.length, 2);

                var layer1 = result[1];
                assert.equal(layer1.name, 'layer2');
                assert.equal(layer1.features.length, 5);

                var layer0ExpectedNames = ['Hawai', 'El Estocolmo'];
                assert.deepEqual(layer0.features.map(function (f) {
                    return f.properties.name;
                }), layer0ExpectedNames);

                var layer1ExpectedNames = ['Hawai', 'El Estocolmo', 'El Rey del Tallarín', 'El Lacón', 'El Pico'];
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
            var mapConfig = {
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
            var testClient = new TestClient(mapConfig, options);
            testClient.getTile(13, 4011, 3088, { layer: 'mapnik', format: 'mvt'}, function (err, mvtTile) {
                assert.ok(!err, err);

                var vtile = new mapnik.VectorTile(13, 4011, 3088);
                vtile.setData(mvtTile);
                assert.equal(vtile.painted(), true);
                assert.equal(vtile.empty(), false);

                var result = vtile.toJSON();
                assert.equal(result.length, 3);

                var layer0 = result[0];
                assert.equal(layer0.name, 'test-name');
                assert.equal(layer0.features.length, 2);

                var layer1 = result[1];
                assert.equal(layer1.name, 'layer1');
                assert.equal(layer1.features.length, 3);

                var layer2 = result[2];
                assert.equal(layer2.name, 'test-name-top');
                assert.equal(layer2.features.length, 5);

                var layer0ExpectedNames = ['Hawai', 'El Estocolmo'];
                assert.deepEqual(layer0.features.map(function (f) {
                    return f.properties.name;
                }), layer0ExpectedNames);

                var layer1ExpectedNames = ['El Rey del Tallarín', 'El Lacón', 'El Pico'];
                assert.deepEqual(layer1.features.map(function (f) {
                    return f.properties.name;
                }), layer1ExpectedNames);

                var layer2ExpectedNames = ['Hawai', 'El Estocolmo', 'El Rey del Tallarín', 'El Lacón', 'El Pico'];
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

        var SQL = [
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
                    }
                }
            ]
        };

        SQL.forEach(function(tuple){
            it('bool and int iteration ' + tuple.name, function (done) {
                mapConfig.layers[0].options.sql = tuple.sql;
                this.testClient = new TestClient(mapConfig);
                this.testClient.getTile(0, 0, 0, { format: 'mvt' }, function (err, mvtTile) {
                    assert.ok(!err);

                    var vtile = new mapnik.VectorTile(0, 0, 0);
                    vtile.setData(mvtTile);
                    var result = vtile.toJSON();

                    var layer0 = result[0];
                    assert.equal(layer0.features.length, 1);
                    assert.strictEqual(layer0.features[0].properties.status2, false);
                    assert.strictEqual(layer0.features[0].properties.data, 0);

                    done();
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
    let points = [ { x : 0, y : 0 }];
    let cmd_points = 0;
    for (let i = 0; i < geometry.length; i++) {
        if (cmd_points === 0) {
            // Read the next command and extract the number of points pending
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
        return (p1.x < p2.x) || ((p1.x === p2.x) && (p1.y < p2.y));
    });
}

// Check if 2 MVT features are equivalent
// Does not compare feature.id since it's optional (Mapnik sets it, St_AsMVT doesn't)
function mvtFeature_cmp(feature1, feature2) {
    assert.equal(feature1.type, feature2.type);
    assert.deepEqual(feature1.properties, feature2.properties);

    assert.equal(feature1.geometry.length, feature2.geometry.length);
    const f1_points = mvtExtractComponents(feature1.geometry);
    const f2_points = mvtExtractComponents(feature2.geometry);
    //TODO: Accept small variances (related to rounding)
    assert.deepEqual(f1_points, f2_points);
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

    assert.equal(layer1.features.length, layer2.features.length);

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

    // Both should be valid
    let valid = vtile1.reportGeometryValiditySync();
    assert.equal(valid.length, 0, "Found invalid geometries: " + valid);
    valid = vtile2.reportGeometryValiditySync();
    assert.equal(valid.length, 0, "Found invalid geometries: " + valid);

    // Layer (number, name, size)
    const t1 = vtile1.toJSON();
    const t2 = vtile2.toJSON();
    assert.equal(t1.length, t2.length);

    t1.forEach(layer1 => {
        // We look for a layer with the same name as the order isn't guaranteed
        let layer2 = t2.find(layer => layer.name === layer1.name);
        assert.ok(layer2, "Could not find layer named '" + layer1.name + "'");
        mvtLayer_cmp(layer1, layer2);
    });

}


// Compares the output returned by both renderers (mapnik and pg_mvt) given the same input
function describe_compare_renderer() {

    const TEST_LIST = [
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
        },
        {
            name: 'Empty geometry',
            tile : { z : 0, x: 0, y: 0 },
            mapConfig : {
                version: '1.7.0',
                layers: [
                    {
                        type: 'mapnik',
                        options: {
                            geom_column : 'the_geom_webmercator',
                            sql: "SELECT 2 AS cartodb_id, null as the_geom_webmercator"
                        }
                    }
                ]
            },
            expected_error : "Error: Tile does not exist"
        },
        {
            name: 'Point',
            tile : { z : 0, x: 0, y: 0 },
            mapConfig : {
                version: '1.7.0',
                layers: [
                    {
                        type: 'mapnik',
                        options: {
                            geom_column: 'the_geom',
                            srid: 3857,
                            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"POINT(-293823 5022065)" +
"'::geometry as the_geom"
                        }
                    }
                ]
            }
        },
        {
            name: 'Multipoint',
            tile : { z : 0, x: 0, y: 0 },
            mapConfig : {
                version: '1.7.0',
                layers: [
                    {
                        type: 'mapnik',
                        options: {
                            geom_column: 'the_geom',
                            srid: 3857,
                            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"MULTIPOINT(-293823 5022065, 3374847 8386059)" +
"'::geometry as the_geom"
                        }
                    }
                ]
            },
        },
        {
            name: 'Multipoint (repeated consecutive)',
            tile : { z : 0, x: 0, y: 0 },
            mapConfig : {
                version: '1.7.0',
                layers: [
                    {
                        type: 'mapnik',
                        options: {
                            geom_column: 'the_geom',
                            srid: 3857,
                            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"MULTIPOINT(-293823 5022065, -293823 5022065, -293823 5022065)" +
"'::geometry as the_geom"
                        }
                    }
                ]
            }
        },
        {
            name: 'Multipoint (repeated non consecutive)',
            tile : { z : 0, x: 0, y: 0 },
            mapConfig : {
                version: '1.7.0',
                layers: [
                    {
                        type: 'mapnik',
                        options: {
                            geom_column: 'the_geom',
                            srid: 3857,
                            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"MULTIPOINT(-293823 5022065, 3374847 8386059, -293823 5022065, -293823 5022065)" +
"'::geometry as the_geom"
                        }
                    }
                ]
            },
            known_issue : "Mapnik doesn't remove non consecutive points"
        },
        {
            name: 'Linestring',
            tile : { z : 0, x: 0, y: 0 },
            mapConfig : {
                version: '1.7.0',
                layers: [
                    {
                        type: 'mapnik',
                        options: {
                            geom_column: 'the_geom',
                            srid: 3857,
                            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"LINESTRING(-293823 5022065, 3374847 8386059)" +
"'::geometry as the_geom"
                        }
                    }
                ]
            }
        },
        {
            name: 'Linestring (zero length)',
            tile : { z : 0, x: 0, y: 0 },
            mapConfig : {
                version: '1.7.0',
                layers: [
                    {
                        type: 'mapnik',
                        options: {
                            geom_column: 'the_geom',
                            srid: 3857,
                            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"LINESTRING(-293823 5022065, -293823 5022065)" +
"'::geometry as the_geom"
                        }
                    }
                ]
            }
        },
        {
            name: 'Linestring (repeated points)',
            tile : { z : 0, x: 0, y: 0 },
            mapConfig : {
                version: '1.7.0',
                layers: [
                    {
                        type: 'mapnik',
                        options: {
                            geom_column: 'the_geom',
                            srid: 3857,
                            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"LINESTRING(-293823 5022065, 3374847 8386059, 3374847 8386059)" +
"'::geometry as the_geom"
                        }
                    }
                ]
            }
        },
        {
            name: 'Linestring (simplify connected segments)',
            tile : { z : 0, x: 0, y: 0 },
            mapConfig : {
                version: '1.7.0',
                layers: [
                    {
                        type: 'mapnik',
                        options: {
                            geom_column: 'the_geom',
                            srid: 3857,
                            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"LINESTRING(0 20037508.3, 0 0, 0 10037508.3, 0 -10037508.3, 0 -20037508.3)" +
"'::geometry as the_geom"
                        }
                    }
                ]
            },
            known_issue : "Mapnik doesn't do it"
        },
        {
            name: 'Linestring (join segments)',
            tile : { z : 0, x: 0, y: 0 },
            mapConfig : {
                version: '1.7.0',
                layers: [
                    {
                        type: 'mapnik',
                        options: {
                            geom_column: 'the_geom',
                            srid: 3857,
                            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"LINESTRING(0 20037508.3, 0 0, 0 -20037508.3)" +
"'::geometry as the_geom"
                        }
                    }
                ]
            },
            known_issue : "Mapnik doesn't do it"
        },
        {
            name: 'Multilinestring',
            tile : { z : 0, x: 0, y: 0 },
            mapConfig : {
                version: '1.7.0',
                layers: [
                    {
                        type: 'mapnik',
                        options: {
                            geom_column: 'the_geom',
                            srid: 3857,
                            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"MULTILINESTRING((-293823 5022065, 3374847 8386059),(-293823 5022065, -1917652 9627396))" +
"'::geometry as the_geom"
                        }
                    }
                ]
            }
        },
        {
            name: 'Multilinestring (zero length)',
            tile : { z : 0, x: 0, y: 0 },
            mapConfig : {
                version: '1.7.0',
                layers: [
                    {
                        type: 'mapnik',
                        options: {
                            geom_column: 'the_geom',
                            srid: 3857,
                            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"MULTILINESTRING((-293823 5022065, -293823 5022065),(-293823 5022065, -1917652 9627396))" +
"'::geometry as the_geom"
                        }
                    }
                ]
            }
        },
        {
            name: 'Multilinestring (simplify duplicated lines)',
            tile : { z : 0, x: 0, y: 0 },
            mapConfig : {
                version: '1.7.0',
                layers: [
                    {
                        type: 'mapnik',
                        options: {
                            geom_column: 'the_geom',
                            srid: 3857,
                            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"MULTILINESTRING((-293823 5022065, -1917652 9627396),(-293823 5022065, -1917652 9627396))" +
"'::geometry as the_geom"
                        }
                    }
                ]
            }
        },
        {
            name: 'Polygon (CW)',
            tile : { z : 0, x: 0, y: 0 },
            mapConfig : {
                version: '1.7.0',
                layers: [
                    {
                        type: 'mapnik',
                        options: {
                            geom_column: 'the_geom',
                            srid: 3857,
                            sql:
"SELECT 2 AS cartodb_id, 'SRID=3857;" +
"POLYGON((-20037508 20037508, 20037508 20037508, 20037508 -20037508, -20037508 -20037508, -20037508 20037508))" +
"'::geometry as the_geom"
                        }
                    }
                ]
            }
        },
    ];

    TEST_LIST.forEach(test => {
        (test.known_issue ? it.skip : it)(test.name, function (done) {

            const testClientMapnik = new TestClient(test.mapConfig, { mvt: { usePostGIS: false } });
            const testClientPg_mvt = new TestClient(test.mapConfig, { mvt: { usePostGIS: true } });
            const options = { format : 'mvt' };

            testClientMapnik.getTile(test.tile.z, test.tile.x, test.tile.y, options, function (err1, mapnikMVT) {
                testClientPg_mvt.getTile(test.tile.z, test.tile.x, test.tile.y, options, function (err2, pgMVT) {
                    if (err1 || err2) {
                        assert.ok(err1);
                        assert.ok(err2);
                        if (test.expected_error) {
                            assert.equal(err1, test.expected_error);
                            assert.equal(err2, test.expected_error);
                        }
                    } else {
                        mvt_cmp(mapnikMVT, pgMVT);
                    }

                    done();
                });
            });
        });
    });
}