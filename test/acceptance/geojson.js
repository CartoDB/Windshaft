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
                var mapnikGeometryMapConfig = {
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

                var testClient = new TestClient(mapnikGeometryMapConfig);
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

    it('query can hold substitution tokens', function(done) {
        var tokenNames = ['bbox', 'scale_denominator', 'pixel_width', 'pixel_height'];
        var tokens = tokenNames.map(function(token) {
            return "!" + token + "! as " + token;
        });

        var sql = 'select *, ' + tokens.join(', ') + ', ST_AsText(!bbox!) as bbox_text from test_table limit 1';
        var propertiesColumns = tokenNames.concat('bbox_text');

        var mapConfig = {
            version: '1.4.0',
            layers: [
                {
                    type: 'cartodb',
                    options: {
                        sql: sql,
                        cartocss: '#layer { marker-fill: red; }',
                        cartocss_version: '2.3.0',
                        columns: propertiesColumns
                    }
                }
            ]
        };

        var expectedProperties = {
            bbox_text: ['POLYGON((',
                '-20037508.5 -20037508.5,',
                '-20037508.5 20037508.5,',
                '20037508.5 20037508.5,',
                '20037508.5 -20037508.5,',
                '-20037508.5 -20037508.5',
            '))'].join(''),
            scale_denominator: 559082268.4151787,
            pixel_width: 156543.03515625,
            pixel_height: 156543.03515625
        };

        var testClient = new TestClient(mapConfig);
        testClient.getTile(0, 0, 0, {layer: 0, format: 'geojson'}, function(err, geojsonTile) {

            assert.ok(!err, err);
            assert.equal(geojsonTile.features.length, 1);
            assert.deepEqual(Object.keys(geojsonTile.features[0].properties), propertiesColumns);
            Object.keys(expectedProperties).forEach(function(prop) {
                assert.equal(geojsonTile.features[0].properties[prop], expectedProperties[prop]);
            });

            done();
        });
    });
});
