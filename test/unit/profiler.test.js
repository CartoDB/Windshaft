var assert        = require('assert'),
    ProfilerProxy      = require('../../lib/windshaft/stats/profiler_proxy');

suite('profiler', function() {

    test('Profiler is null in ProfilerProxy when profiling is not enabled', function() {
        var profilerProxy = new ProfilerProxy({profile: false});
        assert.equal(profilerProxy.profiler, null);
    });

    test('Profiler is NOT null in ProfilerProxy when profiling is enabled', function() {
        var profilerProxy = new ProfilerProxy({profile: true});
        assert.notEqual(profilerProxy.profiler, null);
    });
});
