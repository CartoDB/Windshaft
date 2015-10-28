require('../support/test_helper');

var assert = require('../support/assert');
var TestClient = require('../support/test_client');

describe('Rendering geojsons', function() {

    beforeEach(function () {
        this.mapConfig = TestClient.singleLayerMapConfig('select * from test_table', null, null, 'name');
        this.testClient = new TestClient(this.mapConfig);
        this.options = { format: 'geojson', layer: 'mapnik' };
    });

    describe('single layer', function() {

        it('should return a geojson with points', function (done) {
            this.testClient.getTile(13, 4011, 3088, this.options, function (err, geojsonTile) {
                if (err) {
                    return done(err);
                }
                assert.ok(geojsonTile);
                assert.equal(geojsonTile.type, 'FeatureCollection');
                assert.ok(geojsonTile.features instanceof Array);
                assert.ok(geojsonTile.features.length > 0);
                assert.equal(geojsonTile.features[0].type, 'Feature');
                assert.ok(geojsonTile.features[0].geometry);
                assert.equal(geojsonTile.features[0].geometry.type, 'Point');
                assert.ok(geojsonTile.features[0].geometry.coordinates instanceof Array);
                assert.ok(geojsonTile.features[0].geometry.coordinates.length === 2);
                done();
            });

        });

        it('should return a geojson with polygons', function (done) {
            this.mapConfig = TestClient.singleLayerMapConfig('select * from test_big_poly', null, null, 'name');
            this.testClient = new TestClient(this.mapConfig);


            this.testClient.getTile(13, 4011, 3088, this.options, function (err, geojsonTile) {
                if (err) {
                    return done(err);
                }

                assert.ok(geojsonTile);
                assert.equal(geojsonTile.type, 'FeatureCollection');
                assert.ok(geojsonTile.features instanceof Array);
                assert.ok(geojsonTile.features.length > 0);
                assert.equal(geojsonTile.features[0].type, 'Feature');
                assert.ok(geojsonTile.features[0].geometry);
                assert.equal(geojsonTile.features[0].geometry.type, 'Polygon');
                assert.ok(geojsonTile.features[0].geometry.coordinates instanceof Array);
                done();
            });

        });

        it('should return an empty geojson if tile requested is out of bound', function(done) {
            this.testClient.getTile(1, 4011, 3088, this.options, function (err, geojsonTile) {
                if (err) {
                    return done(err);
                }

                assert.equal(JSON.stringify(geojsonTile), '{}');
                done();
            });
        });

        it('should return an empty geojson if tile requested has not data', function(done) {
            this.testClient.getTile(29, 4011, 3088, this.options, function (err, geojsonTile) {
                if (err) {
                    return done(err);
                }
                assert.equal(JSON.stringify(geojsonTile), '{}');
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
