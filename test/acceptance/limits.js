require('../support/test_helper');

var fs = require('fs');

var _ = require('underscore');

var assert = require('../support/assert');
var TestClient = require('../support/test_client');

describe('render limits', function() {

    function onTileErrorStrategyPass(err, tile, headers, stats, format, callback) {
        callback(err, tile, headers, stats);
    }

    var FIXTURE_IMAGE = './test/fixtures/limits/fallback.png';
    function onTileErrorStrategyFallback(err, tile, headers, stats, format, callback) {
        fs.readFile(FIXTURE_IMAGE, {encoding: null}, function(err, img) {
            callback(null, img, {'Content-Type': 'image/png'}, {});
        });
    }

    var LIMITS_CONFIG = {
        render: 50,
        cacheOnTimeout: false
    };

    var OVERRIDE_OPTIONS = {
        mapnik: {
            mapnik: _.extend({}, TestClient.mapnikOptions, {limits: LIMITS_CONFIG})
        }
    };

    var IMAGE_EQUALS_TOLERANCE_PER_MIL = 25;

    var slowQuery = 'select pg_sleep(1), * from test_table limit 2';
    var slowQueryMapConfig = TestClient.singleLayerMapConfig(slowQuery);

    it('slow query/render returns with 400 status', function(done) {
        var testClient = new TestClient(slowQueryMapConfig, OVERRIDE_OPTIONS, onTileErrorStrategyPass);
        testClient.createLayergroup(function(err) {
            assert.ok(err);
            assert.equal(err.message, 'Render timed out');
            done();
        });
    });

    it('uses onTileErrorStrategy to handle error and modify response', function(done) {
        var testClient = new TestClient(slowQueryMapConfig, OVERRIDE_OPTIONS, onTileErrorStrategyFallback);
        testClient.createLayergroup(function(err, layergroup) {
            assert.ok(!err);
            assert.ok(layergroup);
            assert.ok(layergroup.layergroupid);
            done();
        });
    });

    it('returns a fallback tile that was modified via onTileErrorStrategy', function(done) {
        var testClient = new TestClient(slowQueryMapConfig, OVERRIDE_OPTIONS, onTileErrorStrategyFallback);

        testClient.getTile(0, 0, 0, function(err, tile) {
            assert.imageEqualsFile(tile, FIXTURE_IMAGE, IMAGE_EQUALS_TOLERANCE_PER_MIL, done);
        });
    });

});
