require('../support/test_helper');

var assert = require('../support/assert');
var TestClient = require('../support/test_client');

describe('geojson-simplify', function() {

    beforeEach(function () {
        this.mapConfig = TestClient.singleLayerMapConfig('select * from world_borders_extract', null, null, 'name');
        this.testClient = new TestClient(this.mapConfig);
        this.options = { format: 'geojson', layer: 0 };
    });

    it('should return all features but null geometries for empty/null after simplify', function (done) {
        this.testClient.getTile(0, 0, 0, this.options, function(err, geojsonTile) {
            assert.ok(!err, err);

            assert.equal(geojsonTile.features.length, 3);
            assert.equal(geojsonTile.features[0].properties.name, 'Estonia');
            assert.notEqual(geojsonTile.features[0].geometry, null);
            assert.equal(geojsonTile.features[1].properties.name, 'Monaco');
            assert.equal(geojsonTile.features[1].geometry, null);
            assert.equal(geojsonTile.features[2].properties.name, 'Maldives');
            assert.equal(geojsonTile.features[2].geometry, null);

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
