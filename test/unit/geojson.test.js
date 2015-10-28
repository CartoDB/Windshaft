require('../support/test_helper');

var assert = require('assert');

describe('Geojson renderer', function() {


    var GeojsonRenderer = require('../../lib/windshaft/renderers/mapnik/geojson_renderer.js');
    var dummyLayer = {
        options: {
            sql: 'sql * from test_table'
        }
    };
    var dummyTile = {
        rows: [{
            geojson: {
                features: {}
            }
        }]
    };

    describe('when postres returns a geojson', function() {
        var DummyCartoPSQL = function () {};
        DummyCartoPSQL.prototype.query = function (query, callback) {
            callback(null, dummyTile);
        };

        var dummyCartoPSQLFactory = function () {
            return new DummyCartoPSQL();
        };

        beforeEach(function () {
            this.geojsonRenderer = new GeojsonRenderer(dummyCartoPSQLFactory(), dummyLayer);
        });

        it('.getTile should call the callback with a tile, headers and stats', function(done) {
            this.geojsonRenderer.getTile(0, 0, 0, function (err, tile, headers, stats) {
                assert.ok(!err);
                assert.equal(tile, dummyTile.rows[0].geojson);
                assert.ok(headers);
                assert.ok(stats);
                done();
            });
        });
    });

    describe('when postres returns an error', function() {
        var DummyCartoPSQL = function () {};
        DummyCartoPSQL.prototype.query = function (query, callback) {
            callback(new Error('Something went wrong'));
        };

        var dummyCartoPSQLFactory = function () {
            return new DummyCartoPSQL();
        };

        beforeEach(function () {
            this.geojsonRenderer = new GeojsonRenderer(dummyCartoPSQLFactory(), dummyLayer);
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
