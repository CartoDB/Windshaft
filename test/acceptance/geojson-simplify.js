require('../support/test_helper');

var assert = require('../support/assert');
var TestClient = require('../support/test_client');

describe('geojson-simplify', function() {

    beforeEach(function () {
        this.mapConfig = TestClient.singleLayerMapConfig('select * from world_borders_extract', null, null, 'name');
        this.testClient = new TestClient(this.mapConfig);
        this.options = { format: 'geojson', layer: 0 };
    });

    function validateNonEmptyGeometries(geojsonTile) {
        geojsonTile.features.forEach(function(feature) {
            var geometry = feature.geometry;
            assert.notEqual(geometry, null);
            assert.ok(Array.isArray(geometry.coordinates), geometry.coordinates);
            assert.ok(geometry.coordinates.length > 0);
        });
    }

    it('should return features that are not empty neither null', function (done) {
        this.testClient.getTile(0, 0, 0, this.options, function(err, geojsonTile) {
            assert.ok(!err, err);

            validateNonEmptyGeometries(geojsonTile);

            assert.equal(geojsonTile.features.length, 1);
            assert.equal(geojsonTile.features[0].properties.name, 'Estonia');


            done();
        });
    });

    it('should return features for Monaco and Estonia when zoom is high enough', function (done) {
        this.testClient.getTile(3, 4, 2, this.options, function(err, geojsonTile) {
            assert.ok(!err, err);

            validateNonEmptyGeometries(geojsonTile);

            assert.equal(geojsonTile.features.length, 2);
            assert.equal(geojsonTile.features[0].properties.name, 'Estonia');
            assert.equal(geojsonTile.features[1].properties.name, 'Monaco');


            done();
        });
    });

    it('should return features for Monaco when zoom is high enough', function (done) {
        this.testClient.getTile(8, 133, 93, this.options, function(err, geojsonTile) {
            assert.ok(!err, err);

            validateNonEmptyGeometries(geojsonTile);

            assert.equal(geojsonTile.features.length, 1);
            assert.equal(geojsonTile.features[0].properties.name, 'Monaco');


            done();
        });
    });

    it('should return features for Maldives when zoom is high enough', function (done) {
        this.testClient.getTile(9, 360, 250, this.options, function(err, geojsonTile) {
            assert.ok(!err, err);

            validateNonEmptyGeometries(geojsonTile);

            assert.equal(geojsonTile.features.length, 1);
            assert.equal(geojsonTile.features[0].properties.name, 'Maldives');


            done();
        });
    });

});
