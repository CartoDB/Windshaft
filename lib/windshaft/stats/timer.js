function Timer() {
    this.times = {};
}

module.exports = Timer;

Timer.prototype.start = function(label) {
    this.times[label] = this.times[label] || {};
    this.times[label].start = Date.now();
};

Timer.prototype.end = function(label) {
    this.times[label] = this.times[label] || {};
    this.times[label].end = Date.now();
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
