require('../../support/test_helper.js');
var LayerColumns = require('../../../lib/windshaft/utils/layer-columns');
var assert = require('assert');

describe('geojson-utils', function() {

    function createOptions(interactivity, columns) {
        var options = {
            sql: 'select * from populated_places_simple_reduced',
            cartocss: ['#layer0 {',
                'marker-fill: red;',
                'marker-width: 10;',
                'text-name: [name];',
                '[pop_max>100000] { marker-fill: black; } ',
            '}'].join('\n'),
            cartocss_version: '2.3.0'
        };

        if (interactivity) {
            options.interactivity = interactivity;
        }

        if (columns) {
            options.columns = columns;
        }

        return options;
    }

    it('should not duplicate column names', function() {
        var columns = LayerColumns.getColumns(createOptions());
        assert.deepEqual(columns, ['pop_max', 'name']);
    });

    it('should handle interactivity strings', function() {
        var columns = LayerColumns.getColumns(createOptions('cartodb_id,pop_max'));
        assert.deepEqual(columns, ['pop_max', 'name', 'cartodb_id']);
    });

    it('should handle interactivity array', function() {
        var columns = LayerColumns.getColumns(createOptions(['cartodb_id', 'pop_max']));
        assert.deepEqual(columns, ['pop_max', 'name', 'cartodb_id']);
    });

    it('should handle columns array', function() {
        var columns = LayerColumns.getColumns(createOptions(null, ['cartodb_id', 'pop_min']));
        assert.deepEqual(columns, ['cartodb_id', 'pop_min', 'pop_max', 'name']);
    });

    it('should handle empty columns array', function() {
        var columns = LayerColumns.getColumns(createOptions(null, []));
        assert.deepEqual(columns, ['pop_max', 'name']);
    });

    it('should ignore no-string values', function() {
        var columns = LayerColumns.getColumns(createOptions(null, ['cartodb_id', 'pop_min', 1]));
        assert.deepEqual(columns, ['cartodb_id', 'pop_min', 'pop_max', 'name']);
    });

    it('should ignore null values', function() {
        var columns = LayerColumns.getColumns(createOptions(null, ['cartodb_id', 'pop_min', null]));
        assert.deepEqual(columns, ['cartodb_id', 'pop_min', 'pop_max', 'name']);
    });

    it('should ignore undefined values', function() {
        var columns = LayerColumns.getColumns(createOptions(null,['cartodb_id',undefined,'pop_min']));
        assert.deepEqual(columns, ['cartodb_id', 'pop_min', 'pop_max', 'name']);
    });

    it('should ignore empty values', function() {
        var columns = LayerColumns.getColumns(createOptions(null,['cartodb_id', '' ,'pop_min']));
        assert.deepEqual(columns, ['cartodb_id', 'pop_min', 'pop_max', 'name']);
    });
});
