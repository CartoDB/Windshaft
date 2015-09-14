require('../support/test_helper');

var assert = require('assert');

var StatsClient = require('../../lib/windshaft/stats/client');

describe('stats client', function() {
    var statsInstance;

    before(function() {
        statsInstance = StatsClient.instance;
        StatsClient.instance = null;
    });

    after(function() {
        StatsClient.instance = statsInstance;
    });

    it('reports errors when they repeat', function(done) {
        var WADUS_ERROR = 'wadus_error';
        var statsClient = StatsClient.getInstance({ host: '127.0.0.1', port: 8033 });

        statsClient.socket.emit('error', 'other_error');
        assert.ok(statsClient.last_error);
        assert.equal(statsClient.last_error.msg, 'other_error');
        assert.ok(!statsClient.last_error.interval);

        statsClient.socket.emit('error', WADUS_ERROR);
        assert.ok(statsClient.last_error);
        assert.equal(statsClient.last_error.msg, WADUS_ERROR);
        assert.ok(!statsClient.last_error.interval);

        statsClient.socket.emit('error', WADUS_ERROR);
        assert.ok(statsClient.last_error);
        assert.equal(statsClient.last_error.msg, WADUS_ERROR);
        assert.ok(statsClient.last_error.interval);

        done();
    });
});
