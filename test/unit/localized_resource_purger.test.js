require('../support/test_helper');

var assert = require('assert');
var LocalizedResourcePurger = require('../../lib/windshaft/cache/localized_resource_purger');

describe('LocalizedResourcePurger', function() {
    var intervalInSeconds = 0.010,
        checkHit = intervalInSeconds * 1000 + 5;

    it('reports errors when they repeat', function(done) {
        var hit = false;
        var mmlStore = {
            purgeLocalizedResources: function(ttl, callback) {
                hit = true;
                callback();
            }
        };

        var purger = new LocalizedResourcePurger(mmlStore, intervalInSeconds);
        purger.start();

        setTimeout(function() {
            assert.equal(hit, true);
            hit = false;
            setTimeout(function() {
                assert.equal(hit, true);
                hit = false;
                purger.stop();
                setTimeout(function() {
                    assert.equal(hit, false);
                    done();
                }, checkHit);
            }, checkHit);
        }, checkHit);
    });
});
