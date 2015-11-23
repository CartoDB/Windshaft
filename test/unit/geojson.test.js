require('../support/test_helper');

var assert = require('assert');
var MapConfig = require('../../lib/windshaft/models/mapconfig');
var GeojsonRenderer = require('../../lib/windshaft/renderers/mapnik/geojson_renderer.js');

describe('Geojson renderer', function() {
    var dummyMapConfigRaw = {
        version: '1.4.0',
        layers: [{
            type: 'mapnik',
            options: {
                cartocss_version: '2.3.0',
                cartocss: '#layer { line-width:16; }',
                sql: 'select * from test_table'
            }
        }]
    };
    var mapConfig = MapConfig.create(dummyMapConfigRaw);
    var dummyTile = {
        rows: [{
            geojson: {
              "type": "FeatureCollection",
              "features": [
                {
                  "type": "Feature",
                  "geometry": {
                    "type": "Point",
                    "coordinates": [
                      -411852.28231158,
                      4927604.9906512
                    ]
                  },
                  "properties": {
                    "name": "Hawai",
                    "address": "Calle de Perez Galdos 9, Madrid, Spain"
                  }
                }
              ]
            }
        }]
    };

    describe('when postgres returns a geojson for one layer', function() {
        var CartoPSQLStub = function () {};
        
        CartoPSQLStub.prototype.query = function (query, callback) {
            callback(null, dummyTile);
        };

        var dummyCartoPSQLFactory = function () {
            return new CartoPSQLStub();
        };
        
        beforeEach(function () {
            this.geojsonRenderer = new GeojsonRenderer(dummyCartoPSQLFactory(), mapConfig.getLayers());
        });

        it('.getTile should call the callback with a tile, headers and stats', function(done) {
            this.geojsonRenderer.getTile(0, 0, 0, function (err, tile, headers, stats) {
                
                assert.ok(!err);
                assert.equal(tile, dummyTile.rows[0].geojson);
                assert.deepEqual(headers, { 'Content-Type': 'application/json' });
                assert.ok(stats);
                done();
            });
        });
    });
    
    describe('when postgres returns a geojson for several layer', function() {
        var CartoPSQLStub = function () {};
        CartoPSQLStub.prototype.query = function (query, callback) {
            callback(null, dummyTile);
        };

        var dummyCartoPSQLFactory = function () {
            return new CartoPSQLStub();
        };
        
        var dummyMapConfigRaw = {
            version: '1.4.0',
            layers: [{
                type: 'mapnik',
                options: {
                    cartocss_version: '2.3.0',
                    cartocss: '#layer { line-width:16; }',
                    sql: 'select * from test_table'
                }
            }, {
                type: 'mapnik',
                options: {
                    cartocss_version: '2.3.0',
                    cartocss: '#layer { line-width:16; }',
                    sql: 'select * from test_table'
                }
            }]
        };
        
        var mapConfig = MapConfig.create(dummyMapConfigRaw);

        beforeEach(function () {
            this.geojsonRenderer = new GeojsonRenderer(dummyCartoPSQLFactory(), mapConfig.getLayers());
        });

        it('.getTile should call the callback with a tile, headers and stats', function(done) {
            this.geojsonRenderer.getTile(0, 0, 0, function (err, tile, headers, stats) {
                
                var expectedTile = {
                    type: 'FeatureCollection',
                    features: [
                        dummyTile.rows[0].geojson,
                        dummyTile.rows[0].geojson
                    ]
                };
                
                assert.ok(!err);
                assert.deepEqual(tile, expectedTile);
                assert.deepEqual(headers, { 'Content-Type': 'application/json' });
                assert.ok(stats);
                done();
            });
        });
    });

    describe('when postres returns an error', function() {
        var CartoPSQLStub = function () {};
        CartoPSQLStub.prototype.query = function (query, callback) {
            callback(new Error('Something went wrong'));
        };

        var cartoPSQLFactoryStub = function () {
            return new CartoPSQLStub();
        };

        beforeEach(function () {
            this.geojsonRenderer = new GeojsonRenderer(cartoPSQLFactoryStub(), mapConfig.getLayers());
        });

        it('.getTile should call the callback with an error', function(done) {
            this.geojsonRenderer.getTile(0, 0, 0, function (err, tile, headers, stats) {
                assert.ok(err);
                assert.ok(!tile);
                assert.ok(!headers);
                assert.ok(!stats);
                done();
            });
        });
    });
});
