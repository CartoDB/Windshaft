require('../support/test_helper');

var assert = require('../support/assert');
var TestClient = require('../support/test_client');

describe('geojson-simplify', function() {

    beforeEach(function () {
        this.mapConfig = TestClient.singleLayerMapConfig('select * from world_borders_extract', null, null, 'name');
        this.testClient = new TestClient(this.mapConfig);
        this.options = { format: 'geojson', layer: 0 };
    });

    function mayBeBoundingBox(coordinates) {
        assert.equal(coordinates.length, 5);
    }

    it('should return all features but null geometries for empty/null after simplify', function (done) {
        this.testClient.getTile(0, 0, 0, this.options, function(err, geojsonTile) {
            assert.ok(!err, err);

            assert.equal(geojsonTile.features.length, 3);
            assert.equal(geojsonTile.features[0].properties.name, 'Estonia');
            assert.notEqual(geojsonTile.features[0].geometry, null);

            // Maldives and Monaco geometries will have bounding boxes for each of their geometries
            // as real geometries are being removed by simplification

            assert.equal(geojsonTile.features[1].properties.name, 'Maldives');
            // keeps 67 polygons
            assert.equal(geojsonTile.features[1].geometry.coordinates.length, 67);
            // however all of them are just bounding boxes
            assert.equal(geojsonTile.features[1].geometry.coordinates[0].length, 1);
            geojsonTile.features[1].geometry.coordinates[0].forEach(mayBeBoundingBox);

            assert.equal(geojsonTile.features[2].properties.name, 'Monaco');
            // keeps 1 polygon
            assert.equal(geojsonTile.features[2].geometry.coordinates.length, 1);
            // but it a simple bbox one
            assert.equal(geojsonTile.features[2].geometry.coordinates[0].length, 1);
            geojsonTile.features[2].geometry.coordinates[0].forEach(mayBeBoundingBox);

            done();
        });
    });

    it('should return features for Monaco and Estonia when zoom is high enough', function (done) {
        this.testClient.getTile(3, 4, 2, this.options, function(err, geojsonTile) {
            assert.ok(!err, err);

            assert.equal(geojsonTile.features.length, 2);
            assert.equal(geojsonTile.features[0].properties.name, 'Estonia');
            assert.equal(geojsonTile.features[1].properties.name, 'Monaco');

            done();
        });
    });

    it('should return features for Monaco when zoom is high enough', function (done) {
        this.testClient.getTile(8, 133, 93, this.options, function(err, geojsonTile) {
            assert.ok(!err, err);

            assert.equal(geojsonTile.features.length, 1);
            assert.equal(geojsonTile.features[0].properties.name, 'Monaco');
            assert.notEqual(geojsonTile.features[0].geometry, null);

            done();
        });
    });

    it('should return features for Maldives when zoom is high enough', function (done) {
        this.testClient.getTile(9, 360, 250, this.options, function(err, geojsonTile) {
            assert.ok(!err, err);

            assert.equal(geojsonTile.features.length, 1);
            assert.equal(geojsonTile.features[0].properties.name, 'Maldives');
            assert.notEqual(geojsonTile.features[0].geometry, null);


            done();
        });
    });

});
