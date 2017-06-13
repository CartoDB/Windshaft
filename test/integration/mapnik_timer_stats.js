require('../support/test_helper');

var assert = require('../support/assert');
var windshaft = require('../../lib/windshaft');
var TestClient = require('../support/test_client');

describe('stats.MapnikTimer', function() {

    before(function(done) {
        windshaft.stats.MapnikTimer.flush();
        done();
    });

    after(function(done) {
        windshaft.stats.MapnikTimer.flush();
        done();
    });

    describe('flush() when no map is rendered', function() {
        it('returns nothing when no map is rendered', function(done) {
            assert.equal(windshaft.stats.MapnikTimer.flush(), '');
            done();
        });
    });

    describe('flush() when an image is rendered', function() {
        it('should return some stats when an image is rendered', function(done) {
            var testClient = new TestClient(TestClient.defaultTableMapConfig('test_table'));
            testClient.getTile(13, 4011, 3088, {cache_buster: 'wadus'}, function (err, tile, img, headers) {
                assert.ok(!err);
                assert.notEqual(windshaft.stats.MapnikTimer.flush());
                done();
            });

        });
    });
});
