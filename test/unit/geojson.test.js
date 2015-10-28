require('../support/test_helper');

var assert = require('assert');

describe('Geojson renderer', function() {
    var GeojsonRenderer = require('../../lib/windshaft/renderers/mapnik/geojson_renderer.js');
    var dummyLayer = {
        options: {
            sql: 'irrelevant sql'
        }
    };
    var dummyTile = {
        rows: [{
            geojson: {
                features: {}
            }
        }]
    };
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

    it('.getTile should "return" a tile with headers and stats', function(done) {
        this.geojsonRenderer.getTile(0, 0, 0, function (err, tile, headers) {
            assert.ok(!err);
            assert.equal(tile, dummyTile.rows[0].geojson);
            assert.ok(headers);
            done();
        });
    });

});
