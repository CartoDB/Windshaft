'use strict';

module.exports = class Timer {
    constructor () {
        this.times = {};
    }

    start (label) {
        this.timeIt(label, 'start');
    }

    end (label) {
        this.timeIt(label, 'end');
    }

    timeIt (label, what) {
        this.times[label] = this.times[label] || {};
        this.times[label][what] = Date.now();
    }

    getTimes () {
        const times = {};

        for (const [label, stat] of Object.entries(this.times)) {
            if (stat.start && stat.end) {
                const elapsed = stat.end - stat.start;
                if (elapsed > 0) {
                    times[label] = elapsed;
                }
            }
        }

        return times;
    }
};
