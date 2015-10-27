var format = require('../../utils/format');
var _ = require('underscore');

/**
{
    type: 'category',
    options: {
        column: 'country'
    }
}

{
    accept: ['Spain', 'Germany'], // [1, 3]
    reject: ['Japan'] // [5]
}
 */
function Category(layer, filterDefinition, filterParams) {
    this.layerSql = layer.options.sql;
    this.column = filterDefinition.options.column;

    if (_.isEmpty(filterParams.accept) && _.isEmpty(filterParams.reject)) {
        throw new Error('Category filter expect to have at least one value in accept or reject params');
    }

    this.accept = filterParams.accept;
    this.reject = filterParams.reject;
}

module.exports = Category;

Category.prototype.sql = function() {
    var valueFilters = [];

    if (!_.isEmpty(this.accept)) {
        valueFilters.push(format('{_column} IN ({_values})', {
            _column: this.column,
            _values: this.accept.map(function(value) {
                return Number.isFinite(value) ? value : "'" + value + "'";
            }).join(',')
        }));
    }

    if (!_.isEmpty(this.reject)) {
        valueFilters.push(format('{_column} NOT IN ({_values})', {
            _column: this.column,
            _values: this.reject.map(function(value) {
                return Number.isFinite(value) ? value : "'" + value + "'";
            }).join(',')
        }));
    }

    var filterQuery = 'SELECT * FROM ({_sql}) _cdb_category_filter WHERE {_filters}';
    return format(filterQuery, {
        _sql: this.layerSql,
        _filters: valueFilters.join(' AND ')
    });
};
