require('../support/test_helper');

var assert = require('assert');
var ProfilerProxy = require('../../lib/windshaft/stats/profiler_proxy');

describe('profiler', function() {

    it('Profiler is null in ProfilerProxy when profiling is not enabled', function() {
        var profilerProxy = new ProfilerProxy({profile: false});
        assert.equal(profilerProxy.profiler, null);
    });

    it('Profiler is NOT null in ProfilerProxy when profiling is enabled', function() {
        var profilerProxy = new ProfilerProxy({profile: true});
        assert.notEqual(profilerProxy.profiler, null);
    });
});
