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

    describe('single layer', function() {

        it('should return a geojson with points', function (done) {
            this.testClient.getTile(13, 4011, 3088, this.options, function (err, geojsonTile) {
                assert.ok(!err);
                assert.deepEqual(geojsonTile, geojsonValue.singlelayer);
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
