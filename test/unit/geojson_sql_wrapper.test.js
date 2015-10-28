require('../support/test_helper');

var assert = require('assert');

describe('Geojson sql wrapper', function() {
    var GeojsonSqlWrapper = require('../../lib/windshaft/renderers/mapnik/geojson_sql_wrapper.js');

    beforeEach(function () {
        this.geojsonSqlWrapper = new GeojsonSqlWrapper();
    });

    it('.wrap should return a query well formed', function() {
        var query = this.geojsonSqlWrapper.wrap({
            layerSql: 'select * from test_table',
            geomColumn: 'the_geom_webmercator',
            coord: {
                x: 1,
                y: 1
            },
            zoom: 1
        });

        assert.ok(query.indexOf('SELECT row_to_json(fc) as geojson') === 0);
    });

    it('.wrap should throw an error if context argument is not valid', function() {
        assert.throws(function () {
            this.geojsonSqlWrapper.wrap({
                irrelevant: 'irrelevant'
            });
        }.bind(this),
        ReferenceError);
    });
});
