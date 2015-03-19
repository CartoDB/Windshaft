var StatsClient = require('../../lib/windshaft/stats/client');

suite('stats client', function() {
    var statsInstance;

    suiteSetup(function() {
        statsInstance = StatsClient.instance;
        StatsClient.instance = null;
    });

    test('reports errors when they repeat', function(done) {
        var statsClient = StatsClient.getInstance({ host: '127.0.0.1', port: 8033 });
        statsClient.increment('foo');
        console.log(statsClient.socket.emit('error', 'wadus_error'));
        console.log(statsClient.socket.emit('error', 'wadus_error'));
        setTimeout(done, 2000);
    });

    suiteTeardown(function() {
        StatsClient.instance = statsInstance;
    });
});
