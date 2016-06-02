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

    describe('Invalid geometries', function() {
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

      it('should return an error geojson with points', function (done) {
          this.testClient.getTile(7, 64, 63, this.options, function (err) {
              assert.ok(err, 'Expected error for invalid geometry');
              assert.ok(err.message.match(/TopologyException/i), err.message);
              done();
          });
      });
    });

    describe('use only needed columns', function() {
        var cartocssWithGeometryTypeScenarios = {
            'mapnik::geometry_type': '#layer0[\'mapnik::geometry_type\'=1] { marker-fill: red; marker-width: 10; }',
            'mapnik-geometry-type': '#layer0[\'mapnik-geometry-type\'=1] { marker-fill: red; marker-width: 10; }'
        };

        Object.keys(cartocssWithGeometryTypeScenarios).forEach(function(filterName) {
            it('should skip ' + filterName + ' for properties', function(done) {
                var formulaWidgetMapConfig = {
                    version: '1.5.0',
                    layers: [{
                        type: 'mapnik',
                        options: {
                            sql: 'select * from populated_places_simple_reduced',
                            cartocss: cartocssWithGeometryTypeScenarios[filterName],
                            cartocss_version: '2.0.1',
                            interactivity: 'cartodb_id,pop_max,name,adm0name'
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
});
