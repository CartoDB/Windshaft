require('../support/test_helper');

var assert = require('../support/assert');
var TestClient = require('../support/test_client');
var geojsonValue = require('../support/geojson_value');

describe('Rendering geojsons', function() {

    beforeEach(function () {
        var interactivity = ['cartodb_id', 'name', 'address'].join(',');
        this.mapConfig = TestClient.singleLayerMapConfig('select * from test_table', null, null, interactivity);
        this.testClient = new TestClient(this.mapConfig);
        this.options = { format: 'geojson', layer: 0 };
    });

    function getFeatureByCartodbId(features, cartodbId) {
        for (var i = 0, len = features.length; i < len; i++) {
            if (features[i].properties.cartodb_id === cartodbId) {
                return features[i];
            }
        }
        return {};
    }

    describe('single layer', function() {

        it('should return a geojson with points', function (done) {
            this.testClient.getTile(13, 4011, 3088, this.options, function (err, geojsonTile) {
                assert.ok(!err, err);
                assert.deepEqualGeoJSON(geojsonTile, geojsonValue.singlelayer);
                done();
            });
        });

        it('should return a geojson with polygons', function (done) {
            this.mapConfig = TestClient.singleLayerMapConfig('select * from test_big_poly', null, null, 'name');
            this.testClient = new TestClient(this.mapConfig);
            var polygon = geojsonValue.singlelayerPolygon.features[0].coordinates;

            this.testClient.getTile(13, 4011, 3088, this.options, function (err, geojsonTile) {
                assert.ok(!err, err);
                assert.deepEqual(geojsonTile.features[0].coordinates, polygon);
                done();
            });

        });

        it('should return an empty geojson\'s features if tile requested is out of bound', function(done) {
            this.testClient.getTile(1, 4011, 3088, this.options, function (err, geojsonTile) {
                assert.ok(!err, err);
                assert.deepEqual(geojsonTile.features, []);
                done();
            });
        });

        it('should return an empty geojson\' features if tile requested has not data', function(done) {
            this.testClient.getTile(29, 4011, 3088, this.options, function (err, geojsonTile) {
                assert.ok(!err, err);
                assert.deepEqual(geojsonTile.features, []);
                done();
            });
        });

        it('should return a geojson with properties (name)', function (done) {
            this.mapConfig = TestClient.singleLayerMapConfig('select * from test_table', null, null, 'name');
            this.testClient = new TestClient(this.mapConfig);

            this.testClient.getTile(13, 4011, 3088, this.options, function (err, geojsonTile) {
                assert.ok(!err, err);
                assert.ok(geojsonTile.features[0].properties);
                assert.ok(geojsonTile.features[0].properties.name);
                done();
            });
        });
    });

    describe('when something goes wrong', function() {
        it("should return an error if connection to database fails", function(done) {
            this.testClient.createLayergroup({ dbport: 1234567 }, function(err) {
                assert.ok(err);
                assert.ok(err.message);
                done();
            });
        });
    });

    describe.skip('Make valid invalid geometries', function() {
        before(function () {
            this.mapConfig = TestClient.singleLayerMapConfig(
                'SELECT 1 as cartodb_id, ' +
                'ST_GeomFromText(\'SRID=3857; LINESTRING(0 0, 100000 200000)\') As the_geom_webmercator ' +
                'UNION ALL ' +
                'SELECT 2 as cartodb_id, ' +
                'ST_GeomFromText(\'SRID=3857; POLYGON((0 0, 100000 100000, 100000 200000, 100000 100000, 0 0))\') ' +
                'As the_geom_webmercator', null, null, 'cartodb_id'
            );

        this.testClient = new TestClient(this.mapConfig);
        this.options = { format: 'geojson', layer: 0 };
      });

      it('should return a geojson with points', function (done) {
          this.testClient.getTile(7, 64, 63, this.options, function (err, geojsonTile) {
              assert.ok(!err, err);
              assert.deepEqualGeoJSON(geojsonTile, geojsonValue.makeValidGeojson);
              done();
          });
      });
    });

    describe('use only needed columns', function() {
        it('with aggregation widget, interactivity and cartocss columns', function(done) {
            var widgetMapConfig = {
                version: '1.5.0',
                layers: [{
                    type: 'mapnik',
                    options: {
                        sql: 'select * from populated_places_simple_reduced',
                        cartocss: '#layer0 { marker-fill: red; marker-width: 10; text-name: [name] }',
                        cartocss_version: '2.0.1',
                        widgets: {
                            adm0name: {
                                type: 'aggregation',
                                options: {
                                    column: 'adm0name',
                                    aggregation: 'sum',
                                    aggregationColumn: 'pop_max'
                                }
                            }
                        },
                        interactivity: "cartodb_id,pop_min"
                    }
                }]
            };

            var testClient = new TestClient(widgetMapConfig);
            this.options = { format: 'geojson', layer: 0 };

            testClient.getTile(0, 0, 0, this.options, function (err, geojsonTile) {
                assert.ok(!err, err);
                assert.deepEqual(getFeatureByCartodbId(geojsonTile.features, 1109).properties, {
                    cartodb_id: 1109,
                    name: 'Mardin',
                    adm0name: 'Turkey',
                    pop_max: 71373,
                    pop_min: 57586
                });
                done();
            });
        });

        it('should not duplicate columns', function(done) {
            var widgetMapConfig = {
                version: '1.5.0',
                layers: [{
                    type: 'mapnik',
                    options: {
                        sql: 'select * from populated_places_simple_reduced',
                        cartocss: ['#layer0 {',
                            'marker-fill: red;',
                            'marker-width: 10;',
                            'text-name: [name];',
                            '[pop_max>100000] { marker-fill: black; } ',
                        '}'].join('\n'),
                        cartocss_version: '2.3.0',
                        widgets: {
                            adm0name: {
                                type: 'aggregation',
                                options: {
                                    column: 'adm0name',
                                    aggregation: 'sum',
                                    aggregationColumn: 'pop_max'
                                }
                            }
                        },
                        interactivity: "cartodb_id,pop_max"
                    }
                }]
            };

            var testClient = new TestClient(widgetMapConfig);

            testClient.getTile(0, 0, 0, this.options, function (err, geojsonTile) {
                assert.ok(!err, err);
                assert.deepEqual(getFeatureByCartodbId(geojsonTile.features, 1109).properties, {
                    cartodb_id: 1109,
                    name: 'Mardin',
                    adm0name: 'Turkey',
                    pop_max: 71373
                });
                done();
            });
        });

        it('with formula widget, no interactivity and no cartocss columns', function(done) {
            var formulaWidgetMapConfig = {
                version: '1.5.0',
                layers: [{
                    type: 'mapnik',
                    options: {
                        sql: 'select * from populated_places_simple_reduced where pop_max > 0 and pop_max < 600000',
                        cartocss: '#layer0 { marker-fill: red; marker-width: 10; }',
                        cartocss_version: '2.0.1',
                        interactivity: 'cartodb_id',
                        widgets: {
                            pop_max_f: {
                                type: 'formula',
                                options: {
                                    column: 'pop_max',
                                    operation: 'count'
                                }
                            }
                        }
                    }
                }]
            };

            var testClient = new TestClient(formulaWidgetMapConfig);
            this.options = { format: 'geojson', layer: 0 };

            testClient.getTile(0, 0, 0, this.options, function (err, geojsonTile) {
                assert.ok(!err, err);
                assert.deepEqual(getFeatureByCartodbId(geojsonTile.features, 1109).properties, {
                    cartodb_id: 1109,
                    pop_max: 71373
                });
                done();
            });
        });

        it('with cartocss with multiple expressions', function(done) {
            var formulaWidgetMapConfig = {
                version: '1.5.0',
                layers: [{
                    type: 'mapnik',
                    options: {
                        sql: 'select * from populated_places_simple_reduced where pop_max > 0 and pop_max < 600000',
                        cartocss: '#layer0 { marker-fill: red; marker-width: 10; }' +
                            '#layer0 { text-name: [name]; }' +
                            '#layer0[pop_max>1000] {  text-name: [name]; }' +
                            '#layer0[adm0name=~".*Turkey*"] {  text-name: [name]; }',
                        cartocss_version: '2.0.1',
                        interactivity: 'cartodb_id'
                    }
                }]
            };

            var testClient = new TestClient(formulaWidgetMapConfig);
            this.options = { format: 'geojson', layer: 0 };

            testClient.getTile(0, 0, 0, this.options, function (err, geojsonTile) {
                assert.ok(!err, err);
                assert.deepEqual(getFeatureByCartodbId(geojsonTile.features, 1109).properties, {
                    cartodb_id: 1109,
                    pop_max:71373,
                    name:"Mardin",
                    adm0name:"Turkey"
                });
                done();
            });
        });

    });
});
