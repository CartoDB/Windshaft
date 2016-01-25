require('../support/test_helper.js');

var assert        = require('assert');
var TableNameParser     = require('../../lib/windshaft/utils/table_name_parser');

describe('TableNameParser', function() {

  it('parses table names with scheme and quotes', function(done){

      var test_cases = [
        ['xyz',             { schema: null,       table: 'xyz' }],
        ['"xyz"',           { schema: null,       table: 'xyz' }],
        ['"xy z"',          { schema: null,       table: 'xy z' }],
        ['"xy.z"',          { schema: null,       table: 'xy.z' }],
        ['"x.y.z"',         { schema: null,       table: 'x.y.z' }],
        ['abc.xyz',         { schema: 'abc',      table: 'xyz' }],
        ['"abc".xyz',       { schema: 'abc',      table: 'xyz' }],
        ['abc."xyz"',       { schema: 'abc',      table: 'xyz' }],
        ['"abc"."xyz"',     { schema: 'abc',      table: 'xyz' }],
        ['"a bc"."x yz"',   { schema: 'a bc',     table: 'x yz' }],
        ['"a bc".xyz',      { schema: 'a bc',     table: 'xyz' }],
        ['"a.bc".xyz',      { schema: 'a.bc',     table: 'xyz' }],
        ['"a.b.c".xyz',     { schema: 'a.b.c',    table: 'xyz' }],
        ['"a.b.c.".xyz',    { schema: 'a.b.c.',   table: 'xyz' }],
        ['"a""bc".xyz',     { schema: 'a"bc',     table: 'xyz' }],
        ['"a""bc"."x""yz"', { schema: 'a"bc',     table: 'x"yz' }],
      ];

      test_cases.forEach(function(test_case) {
          var table_name = test_case[0];
          var expected_result = test_case[1];
          var result = TableNameParser.parse(table_name);
          assert.deepEqual(result, expected_result);
      });
      done();
  });

  it('quotes identifiers that need quoting', function(done){
      assert.equal(TableNameParser.quote('x yz'), '"x yz"');
      assert.equal(TableNameParser.quote('x-yz'), '"x-yz"');
      assert.equal(TableNameParser.quote('x.yz'), '"x.yz"');
      done();
  });

  it('doubles quotes', function(done){
      assert.equal(TableNameParser.quote('x"yz'), '"x""yz"');
      assert.equal(TableNameParser.quote('x"y"z'), '"x""y""z"');
      assert.equal(TableNameParser.quote('x""y"z'), '"x""""y""z"');
      assert.equal(TableNameParser.quote('x "yz'), '"x ""yz"');
      assert.equal(TableNameParser.quote('x"y-y"z'), '"x""y-y""z"');
      done();
  });

  it('does not quote identifiers that don\'t need to be quoted', function(done){
      assert.equal(TableNameParser.quote('xyz'), 'xyz');
      assert.equal(TableNameParser.quote('x_z123'), 'x_z123');
      done();
  });

});
