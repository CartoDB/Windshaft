require('../support/test_helper');

var assert = require('../support/assert');
var testClient = require('../support/test_client');

describe('render limits', function() {

    var limitsConfig;
    before(function() {
        limitsConfig = global.environment.renderer.mapnik.limits;
        global.environment.renderer.mapnik.limits = {
            render: 50,
            cacheOnTimeout: false
        };
    });

    after(function() {
        global.environment.renderer.mapnik.limits = limitsConfig;
    });

    it('slow query/render returns with 400 status', function(done) {
        var slowQuery = 'select pg_sleep(1), * from test_table limit 2';
        var slowQueryMapConfig = testClient.singleLayerMapConfig(slowQuery);
        testClient.createLayergroup(slowQueryMapConfig, { statusCode: 400 }, function(err, res) {
            assert.deepEqual(JSON.parse(res.body), { errors: ["Render timed out"] });
            done();
        });
    });

});
