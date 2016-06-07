require('../support/test_helper');

var assert = require('../support/assert');
var TestClient = require('../support/test_client');
var mapnik = require('mapnik');

describe('mvt', function() {

    it('single layer', function (done) {
        var mapConfig = TestClient.singleLayerMapConfig('select * from test_table', null, null, 'name');
        var testClient = new TestClient(mapConfig);

        testClient.getTile(13, 4011, 3088, { layer: 'mapnik', format: 'mvt'}, function (err, mvtTile) {
            var vectorTile = new mapnik.VectorTile(13, 4011, 3088);
            vectorTile.setData(mvtTile);
            vectorTile.parse(function () {
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

                done();
            });
        });

    });

    var multipleLayersMapConfig =  {
        version: '1.3.0',
        layers: [
            {
                type: 'mapnik',
                options: {
                    sql: 'select * from test_table limit 2',
                    cartocss: '#layer { marker-fill:red; marker-width:32; marker-allow-overlap:true; }',
                    cartocss_version: '2.3.0'
                }
            },
            {
                type: 'mapnik',
                options: {
                    sql: 'select * from test_table limit 3 offset 2',
                    cartocss: '#layer { marker-fill:blue; marker-allow-overlap:true; }',
                    cartocss_version: '2.3.0'
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
                    color: 'red'
                }
            },
            {
                type: 'mapnik',
                options: {
                    sql: 'select * from test_table limit 2',
                    cartocss: '#layer { marker-fill:red; marker-width:32; marker-allow-overlap:true; }',
                    cartocss_version: '2.3.0'
                }
            },
            {
                type: 'mapnik',
                options: {
                    sql: 'select * from test_table limit 3 offset 2',
                    cartocss: '#layer { marker-fill:blue; marker-allow-overlap:true; }',
                    cartocss_version: '2.3.0'
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
            vtile.parse(function () {
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

                done();
            });
        };
    }

    it('multiple layers', function(done) {
        var testClient = new TestClient(multipleLayersMapConfig);
        testClient.getTile(13, 4011, 3088, { layer: 'mapnik', format: 'mvt'}, multipleLayersValidation(done));
    });

    it('multiple layers do not specify `mapnik` as layer, use undefined', function(done) {
        var testClient = new TestClient(multipleLayersMapConfig);
        testClient.getTile(13, 4011, 3088, { layer: undefined, format: 'mvt'}, multipleLayersValidation(done));
    });

    describe('multiple layers with other types', function() {

        it('happy case', function(done) {
            var testClient = new TestClient(mixedLayersMapConfig);
            testClient.getTile(13, 4011, 3088, { layer: 'mapnik', format: 'mvt'}, multipleLayersValidation(done));
        });

        it('invalid mvt layer', function(done) {
            var testClient = new TestClient(mixedLayersMapConfig);
            testClient.getTile(13, 4011, 3088, { layer: 0, format: 'mvt'}, function(err) {
                assert.ok(err);
                assert.equal(err.message, 'Unsupported format mvt');
                done();
            });
        });

        it.skip('select one layer', function(done) {
            var testClient = new TestClient(mixedLayersMapConfig);
            testClient.getTile(13, 4011, 3088, { layer: 1, format: 'mvt'}, function (err, mvtTile) {
                assert.ok(!err, err);

                var vtile = new mapnik.VectorTile(13, 4011, 3088);
                vtile.setData(mvtTile);
                vtile.parse(function () {
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

                    done();
                });
            });
        });

        it.skip('select multiple mapnik layers', function(done) {
            var testClient = new TestClient(mixedLayersMapConfig);
            testClient.getTile(13, 4011, 3088, { layer: '1,2', format: 'mvt'}, multipleLayersValidation(done));
        });

        it.skip('filter some mapnik layers', function(done) {
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
                            cartocss_version: '2.3.0'
                        }
                    },
                    {
                        type: 'mapnik',
                        options: {
                            sql: 'select * from test_table limit 3 offset 2',
                            cartocss: '#layer { marker-fill:blue; marker-allow-overlap:true; }',
                            cartocss_version: '2.3.0'
                        }
                    },
                    {
                        type: 'mapnik',
                        options: {
                            sql: 'select * from test_table',
                            cartocss: '#layer { marker-fill:red; marker-width:32; marker-allow-overlap:true; }',
                            cartocss_version: '2.3.0'
                        }
                    }
                ]
            };
            var testClient = new TestClient(mapConfig);
            testClient.getTile(13, 4011, 3088, { layer: '1,3', format: 'mvt'}, function (err, mvtTile) {
                assert.ok(!err, err);

                var vtile = new mapnik.VectorTile(13, 4011, 3088);
                vtile.setData(mvtTile);
                vtile.parse(function () {
                    assert.equal(vtile.painted(), true);
                    assert.equal(vtile.empty(), false);

                    var result = vtile.toJSON();
                    assert.equal(result.length, 2);

                    var layer0 = result[0];
                    assert.equal(layer0.name, 'layer0');
                    assert.equal(layer0.features.length, 2);

                    var layer1 = result[1];
                    assert.equal(layer1.name, 'layer1');
                    assert.equal(layer1.features.length, 5);

                    var layer0ExpectedNames = ['Hawai', 'El Estocolmo'];
                    assert.deepEqual(layer0.features.map(function (f) {
                        return f.properties.name;
                    }), layer0ExpectedNames);

                    var layer1ExpectedNames = ['Hawai', 'El Estocolmo', 'El Rey del Tallarín', 'El Lacón', 'El Pico'];
                    assert.deepEqual(layer1.features.map(function (f) {
                        return f.properties.name;
                    }), layer1ExpectedNames);

                    done();
                });
            });
        });

        it('should be able to access layer names by layer id', function(done) {
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
                        id: "test-name",
                        type: 'mapnik',
                        options: {
                            sql: 'select * from test_table limit 2',
                            cartocss: '#layer { marker-fill:red; marker-width:32; marker-allow-overlap:true; }',
                            cartocss_version: '2.3.0'
                        }
                    },
                    {
                        type: 'mapnik',
                        options: {
                            sql: 'select * from test_table limit 3 offset 2',
                            cartocss: '#layer { marker-fill:blue; marker-allow-overlap:true; }',
                            cartocss_version: '2.3.0'
                        }
                    },
                    {
                        id: "test-name-top",
                        type: 'mapnik',
                        options: {
                            sql: 'select * from test_table',
                            cartocss: '#layer { marker-fill:red; marker-width:32; marker-allow-overlap:true; }',
                            cartocss_version: '2.3.0'
                        }
                    }
                ]
            };
            var testClient = new TestClient(mapConfig);
            testClient.getTile(13, 4011, 3088, { layer: 'mapnik', format: 'mvt'}, function (err, mvtTile) {
                assert.ok(!err, err);

                var vtile = new mapnik.VectorTile(13, 4011, 3088);
                vtile.setData(mvtTile);
                vtile.parse(function () {
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

                    done();
                });
            });
        });
    });

});
