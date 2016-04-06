require('../support/test_helper');

var assert = require('assert');

describe('Geojson sql wrapper', function() {
    var GeojsonSqlWrapper = require('../../lib/windshaft/renderers/mapnik/geojson_sql_wrapper.js');

    beforeEach(function () {
        this.geojsonSqlWrapper = new GeojsonSqlWrapper();
    });

    it('.wrap should throw an error if context argument is not valid', function() {
        assert.throws(function () {
            this.geojsonSqlWrapper.wrap({
                irrelevant: 'irrelevant'
            });
        }.bind(this),
        TypeError);
    });
});
