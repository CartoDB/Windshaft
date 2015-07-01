var Profiler = require('step-profiler');

/**
 * Proxy to encapsulate node-step-profiler module so there is no need to check if there is an instance
 */
function ProfilerProxy(opts) {
    this.profile = !!opts.profile;

    this.profiler = null;
    if (!!opts.profile) {
        this.profiler = new Profiler({statsd_client: opts.statsd_client});
    }
}

ProfilerProxy.prototype.done = function(what) {
    if (this.profile) {
        this.profiler.done(what);
    }
};

ProfilerProxy.prototype.end = function() {
    if (this.profile) {
        this.profiler.end();
    }
};

ProfilerProxy.prototype.start = function(what) {
    if (this.profile) {
        this.profiler.start(what);
    }
};

ProfilerProxy.prototype.add = function(what) {
    if (this.profile) {
        this.profiler.add(what || {});
    }
};

ProfilerProxy.prototype.sendStats = function() {
    if (this.profile) {
        this.profiler.sendStats();
    }
};

ProfilerProxy.prototype.toString = function() {
    return this.profile ? this.profiler.toString() : "";
};

ProfilerProxy.prototype.toJSONString = function() {
    return this.profile ? this.profiler.toJSONString() : "{}";
};

module.exports = ProfilerProxy;
