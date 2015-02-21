var Chronograph  = require('chronograph');
var StatsClient  = require('../../stats/client');

var chronograph = new Chronograph(
    new Chronograph.StatsdReporter(StatsClient.getInstance()),
    {namespace: 'windshaft.torque'}
);

function sql(dbParams, SQLClass) {
    // TODO: cache class instances by dbParams/sqlClass
    return function(query, callback) {
        var pg;
        try {
//console.log("Running query " + query + " with params "); console.dir(dbParams);
            pg = new SQLClass(dbParams);
            pg.query(query, chronograph.before(callback, 'pg.query'), true); // ensure read-only transaction
        } catch (err) {
            callback(err);
        }
    };
}

module.exports = sql;
