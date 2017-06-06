var assert = require('../support/assert');
var windshaft = require('../../lib/windshaft');

var mapnik = require('mapnik');

describe('mapnik_timer', function() {

    it('should wrap around mapnik TimerStats and return the same', function(done) {
        assert.equal(windshaft.stats.MapnikTimer.flush(), mapnik.TimerStats.flush());
        done();
    });

    it('returns nothing when no map is rendered', function(done) {
        assert.equal(windshaft.stats.MapnikTimer.flush(), '');
        done();
    });
});
