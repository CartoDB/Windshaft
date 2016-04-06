require('../../support/test_helper.js');
var geojsonUtils = require('../../../lib/windshaft/utils/geojson_utils');
var assert = require('assert');


describe('geojson-utils', function() {

    function createOptions(interactivity) {
        var options = {
            sql: 'select * from populated_places_simple_reduced',
            cartocss: ['#layer0 {',
                'marker-fill: red;',
                'marker-width: 10;',
                'text-name: [name];',
                '[pop_max>100000] { marker-fill: black; } ',
            '}'].join('\n'),
            cartocss_version: '2.3.0',
            widgets: {
                adm0name: {
                    type: 'aggregation',
                    options: {
                        column: 'adm0name',
                        aggregation: 'sum',
                        aggregationColumn: 'pop_max'
                    }
                }
            }
        };

        if (interactivity) {
            options.interactivity = interactivity;
        }

        return options;
    }


    it('should not duplicate column names', function() {
        var properties = geojsonUtils.getGeojsonProperties(createOptions());
        assert.deepEqual(properties, ['pop_max', 'name', 'adm0name']);
    });

    it('should handle interactivity strings', function() {
        var properties = geojsonUtils.getGeojsonProperties(createOptions('cartodb_id,pop_max'));
        assert.deepEqual(properties, ['pop_max', 'name', 'cartodb_id', 'adm0name']);
    });

    it('should handle interactivity array', function() {
        var properties = geojsonUtils.getGeojsonProperties(createOptions(['cartodb_id', 'pop_max']));
        assert.deepEqual(properties, ['pop_max', 'name', 'cartodb_id', 'adm0name']);
    });
});
