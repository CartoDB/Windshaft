var format = require('../../utils/format');

/**
 Definition
 {
     “type”: “aggregation”,
     “options”: {
         “column”: “country”,
         “aggregation”: “count”
     }
 }

 Params
 {
     “accept”: [“Spain”, “Germany”]
     “reject”: [“Japan”]
 }
 */
function Category(layer, filterDefinition, filterParams) {
    this.layerSql = layer.options.sql;
    this.column = filterDefinition.options.column;

    if (!Array.isArray(filterParams.accept) && !Array.isArray(filterParams.reject)) {
        throw new Error('Category filter expects at least one array in accept or reject params');
    }

    filterParams.accept = filterParams.accept || [];
    filterParams.reject = filterParams.reject || [];

    if (filterParams.accept.length === 0 && filterParams.reject.length === 0) {
        throw new Error('Category filter expects to have at least one value in accept or reject arrays');
    }

    this.accept = filterParams.accept;
    this.reject = filterParams.reject;
}

module.exports = Category;

Category.prototype.sql = function() {
    var valueFilters = [];

    if (Array.isArray(this.accept) && this.accept.length > 0) {
        valueFilters.push(format('{_column} IN ({_values})', {
            _column: this.column,
            _values: this.accept.map(function(value) {
                return Number.isFinite(value) ? value : "'" + value + "'";
            }).join(',')
        }));
    }

    if (Array.isArray(this.reject) && this.reject.length > 0) {
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
