'use strict';

// Dummy query-rewriter which doesn't alter queries

// This class implements the Windshaft query rewriting API:
//
// * query(sql, data) // transform SQL query, with additional data
//
function DefaultQueryRewriter () {
}

module.exports = DefaultQueryRewriter;

DefaultQueryRewriter.prototype.query = function (query, data) {
    // Not using data parameter, but declared here for documentation purposes
    return query;
};
