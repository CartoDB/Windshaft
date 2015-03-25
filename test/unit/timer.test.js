var assert = require('assert');
var Timer = require('../../lib/windshaft/stats/timer');

describe('timer', function() {

    var label = 'foo';
    var timeout = 5;

    it('should report empty object after created', function() {
        var timer = new Timer();
        assert.deepEqual(timer.getTimes(), {});
    });

    it('should report label after start and end', function(done) {
        var timer = new Timer();
        timer.start(label);

        setTimeout(function() {
            timer.end(label);

            var stats = timer.getTimes();
            assert.equal(Object.keys(stats).length, 1);
            assert.ok(stats[label] >= timeout);

            done();
        }, timeout);
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

    it('should report time as 0 when end called before start', function(done) {
        var timer = new Timer();
        timer.end(label);

        setTimeout(function() {
            timer.start(label);

            var stats = timer.getTimes();
            assert.equal(Object.keys(stats).length, 1);
            assert.equal(stats[label], 0);

            done();
        }, timeout);
    });

    it('should report several stats when more than one label is started and ended', function(done) {
        var wadusLabel = 'wadus';

        var timer = new Timer();

        timer.start(label);
        timer.start(wadusLabel);

        setTimeout(function() {
            timer.end(label);
            timer.end(wadusLabel);

            var stats = timer.getTimes();
            assert.equal(Object.keys(stats).length, 2);
            assert.ok(stats[label] >= timeout);
            assert.ok(stats[wadusLabel] >= timeout);

            done();
        }, timeout);
    });

});
