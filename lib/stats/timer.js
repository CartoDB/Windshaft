'use strict';

function Timer () {
    this.times = {};
}

module.exports = Timer;

Timer.prototype.start = function (label) {
    this.timeIt(label, 'start');
};

Timer.prototype.end = function (label) {
    this.timeIt(label, 'end');
};

Timer.prototype.timeIt = function (label, what) {
    this.times[label] = this.times[label] || {};
    this.times[label][what] = Date.now();
};

Timer.prototype.getTimes = function () {
    var self = this;
    var times = {};

    Object.keys(this.times).forEach(function (label) {
        var stat = self.times[label];
        if (stat.start && stat.end) {
            var elapsed = stat.end - stat.start;
            if (elapsed > 0) {
                times[label] = elapsed;
            }
        }
    });

    return times;
};
