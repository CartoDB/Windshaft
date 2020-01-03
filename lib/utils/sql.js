'use strict';

var debug = require('debug')('windshaft:utils');

function sql (dbParams, SQLClass) {
    // TODO: cache class instances by dbParams/sqlClass
    return function (query, callback) {
        var pg;
        try {
            debug('Running query %s with params %s', query, dbParams);
            pg = new SQLClass(dbParams);
            pg.query(query, callback, true); // ensure read-only transaction
        } catch (err) {
            callback(err);
        }
    };
}

module.exports = sql;
