var format = require('../../utils/format');

/**
 Definition
 {
     “type”: “range”,
     “options”: {
         “column”: “population”
     }
 }

 Params
 {
     “min”: 0,
     “max”: 1000
 }
*/
function Range(filterDefinition, filterParams) {
    this.column = filterDefinition.options.column;

    if (!Number.isFinite(filterParams.min) && !Number.isFinite(filterParams.max)) {
        throw new Error('Range filter expect to have at least one value in min or max numeric params');
    }

    this.min = filterParams.min;
    this.max = filterParams.max;
}

module.exports = Range;

Range.prototype.sql = function(rawSql) {
    var minMaxFilter;
    if (Number.isFinite(this.min) && Number.isFinite(this.max)) {
        minMaxFilter = format('{_column} BETWEEN {_min} AND {_max}', {
            _column: this.column,
            _min: this.min,
            _max: this.max
        });
    } else if (Number.isFinite(this.min)) {
        minMaxFilter = format('{_column} > {_min}', { _column: this.column, _min: this.min });
    } else {
        minMaxFilter = format('{_column} < {_max}', { _column: this.column, _max: this.max });
    }

    var filterQuery = 'SELECT * FROM ({_sql}) _cdb_range_filter WHERE {_filter}';
    return format(filterQuery, {
        _sql: rawSql,
        _filter: minMaxFilter
    });
};
