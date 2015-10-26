var format = require('../../utils/format');

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
    this.accept = filterParams.accept || [];
    this.reject = filterParams.reject || [];
}

module.exports = Category;

Category.prototype.sql = function() {
    var filterQuery = 'SELECT * FROM ({_sql}) _cdb_category_filter WHERE {_column} IN ({_values})';
    return format(filterQuery, {
        _sql: this.layerSql,
        _column: this.column,
        _values: this.accept.map(function(value) {
            return Number.isFinite(value) ? value : "'" + value + "'";
        }).join(',')
    });
};
