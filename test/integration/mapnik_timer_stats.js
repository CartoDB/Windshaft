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
            assert.deepEqual(windshaft.stats.MapnikTimer.flush(), {});
            done();
        });
    });

    describe('flush() when an image is rendered', function() {
        it('should return some stats when an image is rendered', function(done) {
            var testClient = new TestClient(TestClient.defaultTableMapConfig('test_table'));
            testClient.getTile(13, 4011, 3088, {cache_buster: 'wadus'}, function (err, tile, img, headers) {
                assert.ok(!err);
                var stats = windshaft.stats.MapnikTimer.flush();
                assert.ok(stats['total_map_rendering'].cpu_time > 0);
                assert.ok(stats['total_map_rendering'].wall_time > 0);
                assert.ok(stats['postgis_datasource::features_with_context::get_resultset'].cpu_time > 0);
                assert.ok(stats['postgis_datasource::features_with_context::get_resultset'].wall_time > 0);
                done();
            });

        });
    });
});
