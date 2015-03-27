var StatsClient = require('../../lib/windshaft/stats/client');

describe('stats client', function() {
    var statsInstance;

    before(function() {
        statsInstance = StatsClient.instance;
        StatsClient.instance = null;
    });

    it('reports errors when they repeat', function(done) {
        var statsClient = StatsClient.getInstance({ host: '127.0.0.1', port: 8033 });
        statsClient.increment('foo');
        console.log(statsClient.socket.emit('error', 'wadus_error'));
        console.log(statsClient.socket.emit('error', 'wadus_error'));
        setTimeout(done, 2000);
    });

    after(function() {
        StatsClient.instance = statsInstance;
    });
});
