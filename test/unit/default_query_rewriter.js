require('../support/test_helper.js');

var assert                 = require('assert');
var DefaultQueryRewriter = require('../../lib/windshaft/utils/default_query_rewriter');
var queryRewriter       = new DefaultQueryRewriter();

describe('Default QueryRewriter', function() {

  it('does not alter queries ', function(done){
    var sql = "SELECT * FROM table1";
    var rewritten_sql = queryRewriter.query(sql);
    assert.equal(rewritten_sql, sql);
    sql = "SELECT * FROM table1 WHERE column1='x'";
    rewritten_sql = queryRewriter.query(sql);
    assert.equal(rewritten_sql, sql);
    sql = "SELECT * FROM table1 JOIN table2 ON (table1.col1=table2.col1)";
    rewritten_sql = queryRewriter.query(sql);
    assert.equal(rewritten_sql, sql);


    sql = "SELECT a+b AS c FROM table1";
    rewritten_sql = queryRewriter.query(sql);
    assert.equal(rewritten_sql, sql);
    sql = "SELECT f(a) AS b FROM table1";
    rewritten_sql = queryRewriter.query(sql);
    assert.equal(rewritten_sql, sql);
    sql = "SELECT * FROM table1 AS x";
    rewritten_sql = queryRewriter.query(sql);
    assert.equal(rewritten_sql, sql);
    sql = "WITH a AS (1) SELECT * FROM table1";
    rewritten_sql = queryRewriter.query(sql);
    assert.equal(rewritten_sql, sql);
    sql = "SELECT * FROM table1 WHERE a=1";
    rewritten_sql = queryRewriter.query(sql);
    assert.equal(rewritten_sql, sql);
    // jshint multistr:true
    sql = "\
        SELECT table1.* FROM table1 \
               JOIN areas ON ST_Intersects(table1.the_geom, areas.the_geom) \
               WHERE areas.name='A' \
          ";
    rewritten_sql = queryRewriter.query(sql);
    assert.equal(rewritten_sql, sql);

    done();
  });
});
