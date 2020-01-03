'use strict';

require('../support/test-helper.js');

var assert = require('assert');
var DefaultQueryRewriter = require('../../lib/windshaft/utils/default_query_rewriter');
var queryRewriter = new DefaultQueryRewriter();

describe('Default QueryRewriter', function () {
    it('does not alter queries ', function (done) {
        var queries = [
            'SELECT * FROM table1',
            "SELECT * FROM table1 WHERE column1='x'",
            'SELECT * FROM table1 JOIN table2 ON (table1.col1=table2.col1)',
            'SELECT a+b AS c FROM table1',
            'SELECT f(a) AS b FROM table1',
            'SELECT * FROM table1 AS x',
            'WITH a AS (1) SELECT * FROM table1',
            'SELECT * FROM table1 WHERE a=1',
            `SELECT table1.* FROM table1
                JOIN areas ON ST_Intersects(table1.the_geom, areas.the_geom)
                WHERE areas.name='A'`
        ];
        queries.forEach(function (sql) {
            var rewrittenSql = queryRewriter.query(sql);
            assert.equal(rewrittenSql, sql);
        });
        done();
    });
});
