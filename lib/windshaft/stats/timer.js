function Timer() {
    this.times = {};
}

module.exports = Timer;

Timer.prototype.start = function(label) {
    this.timeIt(label, 'start');
};

Timer.prototype.end = function(label) {
    this.timeIt(label, 'end');
};

Timer.prototype.timeIt = function(label, what) {
    this.times[label] = this.times[label] || {};
    this.times[label][what] = Date.now();
};

Timer.prototype.getTimes = function() {
    var self = this;
    var times = {};

    Object.keys(this.times).forEach(function(label) {
        var stat = self.times[label];
        if (stat.start && stat.end) {
            times[label] = Math.max(0, stat.end - stat.start);
        }
    });

    return times;
};
