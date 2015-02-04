var th = require('../support/test_helper.js');
var assert = require('assert');
var Datasource = require('../../lib/windshaft/models/datasource');
var MapConfig = require('../../lib/windshaft/models/mapconfig');

suite('datasource', function() {

    test('empty datasource reports isEmpty', function(done) {
        var emptyDatasource = Datasource.EmptyDatasource();
        assert.ok(emptyDatasource.isEmpty());
        done();
    })

});
