require('../../support/test_helper.js');
var geojsonUtils = require('../../../lib/windshaft/utils/geojson_utils');
var assert = require('assert');


describe('geojson-utils', function() {

    function createOptions(interactivity, extra) {
        var options = {
            sql: 'select * from populated_places_simple_reduced',
            cartocss: ['#layer0 {',
                'marker-fill: red;',
                'marker-width: 10;',
                'text-name: [name];',
                '[pop_max>100000] { marker-fill: black; } ',
            '}'].join('\n'),
            cartocss_version: '2.3.0',
            widgets: extra.widgets ? extra.widgets : undefined,
            dataviews: extra.dataviews ? extra.dataviews : undefined
        };

        if (interactivity) {
            options.interactivity = interactivity;
        }

        return options;
    }

    var widgetsDefinition = {
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

    var dataviewsDefinition = {
        dataviews: {
            "area_histogram": {
                "source": {
                    "id": "a0"
                },
                "type": "histogram",
                "options": {
                    "column": "area"
                }
            }
        }
    };

    describe('with widgets', function () {

        it('should not duplicate column names', function() {
            var properties = geojsonUtils.getGeojsonProperties(createOptions(null, widgetsDefinition));
            assert.deepEqual(properties, ['pop_max', 'name', 'adm0name']);
        });

        it('should handle interactivity strings', function() {
            var properties = geojsonUtils.getGeojsonProperties(createOptions('cartodb_id,pop_max', widgetsDefinition));
            assert.deepEqual(properties, ['pop_max', 'name', 'cartodb_id', 'adm0name']);
        });

        it('should handle interactivity array', function() {
            var properties = geojsonUtils.getGeojsonProperties(
                createOptions(['cartodb_id', 'pop_max'], widgetsDefinition)
            );
            assert.deepEqual(properties, ['pop_max', 'name', 'cartodb_id', 'adm0name']);
        });
    });

    describe('with dataviews', function () {

        it('should not duplicate column names', function() {
            var properties = geojsonUtils.getGeojsonProperties(createOptions(null, dataviewsDefinition));
            assert.deepEqual(properties, ['pop_max', 'name', 'area']);
        });

        it('should handle interactivity strings', function() {
            var properties = geojsonUtils.getGeojsonProperties(
                createOptions('cartodb_id,pop_max', dataviewsDefinition)
            );
            assert.deepEqual(properties, ['pop_max', 'name', 'cartodb_id', 'area']);
        });

        it('should handle interactivity array', function() {
            var properties = geojsonUtils.getGeojsonProperties(
                createOptions(['cartodb_id', 'pop_max'], dataviewsDefinition)
            );
            assert.deepEqual(properties, ['pop_max', 'name', 'cartodb_id', 'area']);
        });
    });

    describe('with both dataviews and widgets', function () {

        var widgetsAndDataviewDefinition = {
            widgets: widgetsDefinition.widgets,
            dataviews: dataviewsDefinition.dataviews,
        };

        it('should not duplicate column names', function() {
            var properties = geojsonUtils.getGeojsonProperties(createOptions(null, widgetsAndDataviewDefinition));
            assert.deepEqual(properties, ['pop_max', 'name', 'adm0name', 'area']);
        });

        it('should handle interactivity strings', function() {
            var properties = geojsonUtils.getGeojsonProperties(
                createOptions('cartodb_id,pop_max', widgetsAndDataviewDefinition)
            );
            assert.deepEqual(properties, ['pop_max', 'name', 'cartodb_id', 'adm0name', 'area']);
        });

        it('should handle interactivity array', function() {
            var properties = geojsonUtils.getGeojsonProperties(
                createOptions(['cartodb_id', 'pop_max'], widgetsAndDataviewDefinition)
            );
            assert.deepEqual(properties, ['pop_max', 'name', 'cartodb_id', 'adm0name', 'area']);
        });
    });

});
