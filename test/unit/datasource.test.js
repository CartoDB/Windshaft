'use strict';

require('../support/test_helper.js');

var assert = require('assert');
var Datasource = require('../../lib/windshaft/models/datasource');

describe('datasource', function () {
    it('empty datasource reports isEmpty', function (done) {
        var emptyDatasource = Datasource.EmptyDatasource();
        assert.ok(emptyDatasource.isEmpty());
        done();
    });

    it('all layers as undefined should report an empty datasource', function (done) {
        var datasourceBuilder = new Datasource.Builder();
        datasourceBuilder.withLayerDatasource(0, undefined);
        var emptyDatasource = datasourceBuilder.build();
        assert.ok(emptyDatasource.isEmpty());
        done();
    });

    it('at least one non-undefined should NOT report an empty datasource', function (done) {
        var datasourceBuilder = new Datasource.Builder();
        datasourceBuilder.withLayerDatasource(0, { user: 'foo' });
        var emptyDatasource = datasourceBuilder.build();
        assert.equal(emptyDatasource.isEmpty(), false);
        done();
    });

    it('at least one non-undefined (in the middle) should NOT report an empty datasource', function (done) {
        var datasourceBuilder = new Datasource.Builder();
        datasourceBuilder.withLayerDatasource(4, { user: 'foo' });
        var emptyDatasource = datasourceBuilder.build();
        assert.equal(emptyDatasource.isEmpty(), false);
        done();
    });
});
