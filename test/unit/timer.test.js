require('../support/test_helper');

var assert = require('assert');
var Timer = require('../../lib/windshaft/stats/timer');

describe('timer', function() {

    var label = 'foo';
    var elapsedTimeBetweenDateNowCalls = 5;

    var nowFn = Date.now;

    before(function() {
        var nowStartTime = 0;
        Date.now = function() {
            nowStartTime += elapsedTimeBetweenDateNowCalls;
            return nowStartTime;
        };
    });

    after(function() {
        Date.now = nowFn;
    });

    it('should report empty object after created', function() {
        var timer = new Timer();
        assert.deepEqual(timer.getTimes(), {});
    });

    it('should report label after start and end', function() {
        var timer = new Timer();
        timer.start(label);

        timer.end(label);

        var stats = timer.getTimes();
        assert.equal(Object.keys(stats).length, 1);
        assert.ok(stats[label] >= elapsedTimeBetweenDateNowCalls);
    });

    it('should report empty object after start only called', function() {
        var timer = new Timer();
        timer.start(label);
        assert.deepEqual(timer.getTimes(), {});
    });

    it('should report empty object after end only called', function() {
        var timer = new Timer();
        timer.end(label);
        assert.deepEqual(timer.getTimes(), {});
    });

    it('should report time as 0 when end called before start', function() {
        var timer = new Timer();
        timer.end(label);

        timer.start(label);

        var stats = timer.getTimes();
        assert.equal(Object.keys(stats).length, 1);
        assert.equal(stats[label], 0);
    });

    it('should report several stats when more than one label is started and ended', function() {
        var wadusLabel = 'wadus';

        var timer = new Timer();

        timer.start(label);
        timer.start(wadusLabel);

        timer.end(label);
        timer.end(wadusLabel);

        var stats = timer.getTimes();
        assert.equal(Object.keys(stats).length, 2);
        assert.ok(stats[label] >= elapsedTimeBetweenDateNowCalls);
        assert.ok(stats[wadusLabel] >= elapsedTimeBetweenDateNowCalls);
    });

});
