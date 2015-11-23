require('../support/test_helper');

var assert = require('../support/assert');
var TestClient = require('../support/test_client');

describe('Rendering multiple geojson layers', function() {
    
    var cartocssVersion = '2.3.0';
    var cartocss = '#layer { line-width:16; }';

    var mapnikLayer1 = {
        type: 'mapnik',
        options: {
            sql: 'select * from test_table limit 2',
            cartocss_version: cartocssVersion,
            cartocss: cartocss
        }
    };
    
    var mapnikLayer2 = {
        type: 'mapnik',
        options: {
            sql: 'select * from test_table_2 limit 4',
            cartocss_version: cartocssVersion,
            cartocss: cartocss
        }
    };

    beforeEach(function () {
        this.testClient = new TestClient({
            version: '1.4.0',
            layers: [
                mapnikLayer1,
                mapnikLayer2
            ]
        });
        this.options = { format: 'geojson'};
    });
    
    it('for all layers should return a multilayer geojson', function (done) {
        this.options.layer = undefined;
      
        this.testClient.getTile(13, 4011, 3088, this.options, function (err, geojsonTile) {
            assert.ok(!err);
            assert.ok(geojsonTile);
            assert.equal(geojsonTile.type, 'FeatureCollection');
            assert.ok(geojsonTile.features instanceof Array);
            assert.equal(geojsonTile.features.length, 2);
            assert.equal(geojsonTile.features[0].type, 'FeatureCollection');
            assert.ok(geojsonTile.features[0].features instanceof Array);
            assert.equal(geojsonTile.features[0].features[0].geometry.type, 'Point');
            assert.equal(geojsonTile.features[1].type, 'FeatureCollection');
            assert.ok(geojsonTile.features[1].features instanceof Array);
            assert.equal(geojsonTile.features[1].features[0].geometry.type, 'Point');

            done();
        });
    });

    it('for layer 0 should return a geojson with points', function (done) {
        this.options.layer = 0;
        
        this.testClient.getTile(13, 4011, 3088, this.options, function (err, geojsonTile) {
            assert.ok(!err);
            assert.ok(geojsonTile);
            assert.equal(geojsonTile.type, 'FeatureCollection');
            assert.ok(geojsonTile.features instanceof Array);
            assert.ok(geojsonTile.features.length > 0);
            assert.equal(geojsonTile.features[0].type, 'Feature');
            assert.equal(geojsonTile.features[0].geometry.type, 'Point');
            done();
        });
    });
    
    it('for layer 1 should return a geojson with points', function (done) {
        this.options.layer = 1;
        
        this.testClient.getTile(13, 4011, 3088, this.options, function (err, geojsonTile) {
            assert.ok(!err);
            assert.ok(geojsonTile);
            assert.equal(geojsonTile.type, 'FeatureCollection');
            assert.ok(geojsonTile.features instanceof Array);
            assert.ok(geojsonTile.features.length > 0);
            assert.equal(geojsonTile.features[0].type, 'Feature');
            assert.equal(geojsonTile.features[0].geometry.type, 'Point');
            done();
        });
    });
    
    it('for layer 2 (out of range) should return a specific error', function (done) {
        this.options.layer = 2;
        
        this.testClient.getTile(13, 4011, 3088, this.options, function (err, geojsonTile) {
            assert.ok(err);
            assert.equal(err.message, "Layer '2' not found in layergroup");
            assert.ok(!geojsonTile);
            
            done();
        });
    });
});
