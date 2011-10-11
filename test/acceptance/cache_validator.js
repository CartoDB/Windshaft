

var   assert      = require('../support/assert'),
      tests       = module.exports = {},
      th          = require(__dirname + '/../test_helper'),
      CacheValidator = require(__dirname + '/../../lib/windshaft/cache_validator')

var cache = CacheValidator(global.environment.redis);

tests["should get the timestamp it sets"] = function() {
    var d = new Date().getTime();
    cache.setTimestamp('mydatabase', 'mytable', d, function() {
        cache.getTimestamp('mydatabase', 'mytable', function(err, t) {
            assert.eql(t, d);
        })
    });
}

tests["should get null when timestamp is not set"] = function() {
    var d = new Date().getTime();
    cache.getTimestamp('mydatabase', 'mytable2', function(err, t) {
        assert.ok(t === null);
    })
}
