require('../support/test_helper');

var assert = require('../support/assert');
var TestClient = require('../support/test_client');
var geojsonValue = require('../support/geojson_value');

describe('Rendering geojsons', function() {

    beforeEach(function () {
        this.mapConfig = TestClient.singleLayerMapConfig('select * from test_table', null, null, 'name');
        this.testClient = new TestClient(this.mapConfig);
        this.options = { format: 'geojson', layer: 0 };
    });

    function assertGeoJSONFeature(actual, expected) {
        assert.equal(actual.type, expected.type);
        assert.equal(actual.features.length, expected.features.length);

        actual.features.forEach(function(feature, idx) {
            assert.ok(expected.features[idx], 'missing expected feature for index=' + idx);

            var expectedFeature = expected.features[idx];
            assert.equal(feature.type, expectedFeature.type);

            assert.deepEqual(feature.geometry, expectedFeature.geometry);

            Object.keys(feature.properties).forEach(function(pKey) {
                if (pKey.match(/_at$/)) {
                    var actualDate = new Date(feature.properties[pKey]);
                    var expectedDate = new Date(expectedFeature.properties[pKey]);
                    assert.equal(actualDate.getTime(), expectedDate.getTime());
                } else {
                    assert.equal(feature.properties[pKey], expectedFeature.properties[pKey]);
                }
            });
        });
    }

    describe('single layer', function() {

        it('should return a geojson with points', function (done) {
            this.testClient.getTile(13, 4011, 3088, this.options, function (err, geojsonTile) {
                assert.ok(!err);
                assertGeoJSONFeature(geojsonTile, geojsonValue.singlelayer);
                done();
            });
        });

        it('should return a geojson with polygons', function (done) {
            this.mapConfig = TestClient.singleLayerMapConfig('select * from test_big_poly', null, null, 'name');
            this.testClient = new TestClient(this.mapConfig);
            var polygon = geojsonValue.singlelayerPolygon.features[0].coordinates;

            this.testClient.getTile(13, 4011, 3088, this.options, function (err, geojsonTile) {
                assert.ok(!err);
                assert.deepEqual(geojsonTile.features[0].coordinates, polygon);
                done();
            });

        });

        it('should return an empty geojson\'s features if tile requested is out of bound', function(done) {
            this.testClient.getTile(1, 4011, 3088, this.options, function (err, geojsonTile) {
                assert.ok(!err);
                assert.deepEqual(geojsonTile.features, []);
                done();
            });
        });

        it('should return an empty geojson\' features if tile requested has not data', function(done) {
            this.testClient.getTile(29, 4011, 3088, this.options, function (err, geojsonTile) {
                assert.ok(!err);
                assert.deepEqual(geojsonTile.features, []);
                done();
            });
        });

        it('should return a geojson with properties (name & address)', function (done) {
            this.mapConfig = TestClient.singleLayerMapConfig('select * from test_table', null, null, 'name');
            this.testClient = new TestClient(this.mapConfig);

            this.testClient.getTile(13, 4011, 3088, this.options, function (err, geojsonTile) {
                assert.ok(!err);
                assert.ok(geojsonTile.features[0].properties);
                assert.ok(geojsonTile.features[0].properties.name);
                assert.ok(geojsonTile.features[0].properties.address);
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
});
