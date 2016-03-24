require('../support/test_helper');

var assert = require('../support/assert');
var geojsonValue = require('../support/geojson_value').multilayer;
var TestClient = require('../support/test_client');

describe('Rendering multiple geojson layers', function() {
    var cartocssVersion = '2.3.0';
    var cartocss = '#layer { line-width:16; }';

    var mapnikLayer1 = {
        type: 'mapnik',
        options: {
            sql: 'select * from test_table limit 2',
            cartocss_version: cartocssVersion,
            cartocss: cartocss,
            interactivity: 'cartodb_id'
        }
    };

    var mapnikLayer2 = {
        type: 'mapnik',
        options: {
            sql: 'select * from test_table_2 limit 4',
            cartocss_version: cartocssVersion,
            cartocss: cartocss,
            interactivity: 'cartodb_id'
        }
    };

    var mapnikLayer3 = {
        type: 'mapnik',
        options: {
            sql: 'select * from test_table_3 limit 3',
            cartocss_version: cartocssVersion,
            cartocss: cartocss,
            interactivity: 'cartodb_id'
        }
    };

    beforeEach(function () {
        this.testClient = new TestClient({
            version: '1.4.0',
            layers: [
                mapnikLayer1,
                mapnikLayer2,
                mapnikLayer3
            ]
        });
        this.options = { format: 'geojson'};
    });

    it('for all layers should return a multilayer geojson', function (done) {
        this.options.layer = undefined;

        this.testClient.getTile(13, 4011, 3088, this.options, function (err, geojsonTile) {
            assert.ok(!err);
            assert.deepEqualGeoJSON(geojsonTile, geojsonValue);
            done();
        });
    });

    it('for "mapnik" layer param should return a multilayer geojson', function (done) {
        this.options.layer = 'mapnik';

        this.testClient.getTile(13, 4011, 3088, this.options, function (err, geojsonTile) {
            assert.ok(!err);
            assert.deepEqualGeoJSON(geojsonTile, geojsonValue);
            done();
        });
    });

    it('for layers 0 and 2 should return a multilayer geojson using the requested layers', function (done) {
        this.options.layer = '0,2';
        var geojsonExpected = {
            type: "FeatureCollection",
            features: [
                geojsonValue.features[0],
                geojsonValue.features[2]
            ]
        };

        this.testClient.getTile(13, 4011, 3088, this.options, function (err, geojsonTile) {
            assert.ok(!err);
            assert.deepEqualGeoJSON(geojsonTile, geojsonExpected);
            done();
        });
    });

    it('for layers 1 and 2 should return a multilayer geojson using the requested layers', function (done) {
        this.options.layer = '1,2';
        var geojsonExpected = {
            type: "FeatureCollection",
            features: [
                geojsonValue.features[1],
                geojsonValue.features[2]
            ]
        };

        this.testClient.getTile(13, 4011, 3088, this.options, function (err, geojsonTile) {
            assert.ok(!err);
            assert.deepEqualGeoJSON(geojsonTile, geojsonExpected);
            done();
        });
    });

    it('for layer 0 should return a geojson with points', function (done) {
        this.options.layer = 0;

        this.testClient.getTile(13, 4011, 3088, this.options, function (err, geojsonTile) {
            assert.ok(!err);
            assert.deepEqualGeoJSON(geojsonTile, geojsonValue.features[0]);
            done();
        });
    });

    it('for layer 1 should return a geojson with points', function (done) {
        this.options.layer = 1;

        this.testClient.getTile(13, 4011, 3088, this.options, function (err, geojsonTile) {
            assert.ok(!err);
            assert.deepEqualGeoJSON(geojsonTile, geojsonValue.features[1]);
            done();
        });
    });

    it('for layer 3 (out of range) should return a specific error', function (done) {
        this.options.layer = 3;

        this.testClient.getTile(13, 4011, 3088, this.options, function (err, geojsonTile) {
            assert.ok(err);
            assert.equal(err.message, "Layer '3' not found in layergroup");
            assert.ok(!geojsonTile);

            done();
        });
    });

    it('for layer 0 and 3 (one is out of range) should return a specific error', function (done) {
        this.options.layer = '0,3';

        this.testClient.getTile(13, 4011, 3088, this.options, function (err, geojsonTile) {
            assert.ok(err);
            assert.equal(err.message, "Invalid layer filtering");
            assert.ok(!geojsonTile);

            done();
        });
    });

    it('for layer 3 and 2 (invalid layer filtering) should return a specific error', function (done) {
        this.options.layer = '3,2';

        this.testClient.getTile(13, 4011, 3088, this.options, function (err, geojsonTile) {
            assert.ok(err);
            assert.equal(err.message, "Invalid layer filtering");
            assert.ok(!geojsonTile);

            done();
        });
    });
});
