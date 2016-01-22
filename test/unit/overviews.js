require('../support/test_helper.js');

var assert        = require('assert');
var Overviews     = require('../../lib/windshaft/utils/overviews');

function normalize_whitespace(txt) {
  return txt.replace(/\s+/g, " ").trim();
}

// compare SQL statements ignoring whitespace
function assertSameSql(sql1, sql2) {
    assert.equal(normalize_whitespace(sql1), normalize_whitespace(sql2));
}

describe('Overviews-support', function() {

  it('does not alter queries if no overviews data is present', function(done){
    var sql = "SELECT * FROM table1";
    var overviews = {};
    var overviews_sql = Overviews.query(sql, overviews);
    assert.equal(overviews_sql, sql);
    done();
  });


  it('does not alter queries which don\'t use overviews', function(done){
    var sql = "SELECT * FROM table1";
    var overviews = {
        table2: {
          0: { table: 'table2_ov0' },
          1: { table: 'table2_ov1' },
          4: { table: 'table2_ov4' }
        }
    };
    var overviews_sql = Overviews.query(sql, overviews);
    assert.equal(overviews_sql, sql);
    done();
  });

  // jshint multistr:true

  it('generates query with single overview layer for level 0', function(done){
    var sql = "SELECT * FROM table1";
    var overviews = {
        table1: {
          0: { table: 'table1_ov0' }
        }
    };
    var overviews_sql = Overviews.query(sql, overviews);
    var expected_sql = "\
        WITH\
          vovw_scale AS ( SELECT CDB_ZoomFromScale(!scale_denominator!) AS vovw_z ),\
          vovw_table1 AS (\
            SELECT * FROM table1_ov0, vovw_scale WHERE vovw_z = 0\
            UNION ALL\
            SELECT * FROM table1, vovw_scale WHERE vovw_z > 0\
          )\
        SELECT * FROM vovw_table1\
    ";
    assertSameSql(overviews_sql, expected_sql);
    done();
  });

  it('generates query with single overview layer for level >0', function(done){
    var sql = "SELECT * FROM table1";
    var overviews = {
        table1: {
          2: { table: 'table1_ov2' }
        }
    };
    var overviews_sql = Overviews.query(sql, overviews);
    var expected_sql = "\
        WITH\
          vovw_scale AS ( SELECT CDB_ZoomFromScale(!scale_denominator!) AS vovw_z ),\
          vovw_table1 AS (\
            SELECT * FROM table1_ov2, vovw_scale WHERE vovw_z <= 2\
            UNION ALL\
            SELECT * FROM table1, vovw_scale WHERE vovw_z > 2\
          )\
        SELECT * FROM vovw_table1\
    ";
    assertSameSql(overviews_sql, expected_sql);
    done();
  });

  it('generates query with multiple overview layers for all levels up to N', function(done){
    var sql = "SELECT * FROM table1";
    var overviews = {
        table1: {
          0: { table: 'table1_ov0' },
          1: { table: 'table1_ov1' },
          2: { table: 'table1_ov2' },
          3: { table: 'table1_ov3' }
        }
    };
    var overviews_sql = Overviews.query(sql, overviews);
    var expected_sql = "\
        WITH\
          vovw_scale AS ( SELECT CDB_ZoomFromScale(!scale_denominator!) AS vovw_z ),\
          vovw_table1 AS (\
            SELECT * FROM table1_ov0, vovw_scale WHERE vovw_z = 0\
            UNION ALL\
            SELECT * FROM table1_ov1, vovw_scale WHERE vovw_z = 1\
            UNION ALL\
            SELECT * FROM table1_ov2, vovw_scale WHERE vovw_z = 2\
            UNION ALL\
            SELECT * FROM table1_ov3, vovw_scale WHERE vovw_z = 3\
            UNION ALL\
            SELECT * FROM table1, vovw_scale WHERE vovw_z > 3\
          )\
        SELECT * FROM vovw_table1\
    ";
    assertSameSql(overviews_sql, expected_sql);
    done();
  });

  it('generates query with multiple overview layers for random levels', function(done){
    var sql = "SELECT * FROM table1";
    var overviews = {
        table1: {
          0: { table: 'table1_ov0' },
          1: { table: 'table1_ov1' },
          6: { table: 'table1_ov6' }
        }
    };
    var overviews_sql = Overviews.query(sql, overviews);
    var expected_sql = "\
        WITH\
          vovw_scale AS ( SELECT CDB_ZoomFromScale(!scale_denominator!) AS vovw_z ),\
          vovw_table1 AS (\
            SELECT * FROM table1_ov0, vovw_scale WHERE vovw_z = 0\
            UNION ALL\
            SELECT * FROM table1_ov1, vovw_scale WHERE vovw_z = 1\
            UNION ALL\
            SELECT * FROM table1_ov6, vovw_scale WHERE vovw_z > 1 AND vovw_z <= 6\
            UNION ALL\
            SELECT * FROM table1, vovw_scale WHERE vovw_z > 6\
          )\
        SELECT * FROM vovw_table1\
    ";
    assertSameSql(overviews_sql, expected_sql);
    done();
  });

});
