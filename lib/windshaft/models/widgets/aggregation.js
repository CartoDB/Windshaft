var _ = require('underscore');
var format = require('../../utils/format');

var VALID_OPERATIONS = {
    count: true
};

/**
 {
     type: 'aggregation',
     options: {
         column: 'name',
         aggregation: 'count' // it could be, e.g., sum if column is numeric
     }
 }
 */
function Aggregation(aggregationOptions, layerOptions) {
    layerOptions = layerOptions || {};

    if (!_.isString(aggregationOptions.column)) {
        throw new Error('Aggregation expects `column` in widget options');
    }

    if (!_.isString(aggregationOptions.aggregation)) {
        throw new Error('Aggregation expects `aggregation` operation in widget options');
    }

    if (!VALID_OPERATIONS[aggregationOptions.aggregation]) {
        throw new Error("Aggregation does not support '" + aggregationOptions.aggregation + "' operation");
    }

    if (!_.isString(layerOptions.sql)) {
        throw new Error('Aggregation expects `sql` query in layer options');
    }

    this.column = aggregationOptions.column;
    this.layerSql = layerOptions.sql;
}

module.exports = Aggregation;

Aggregation.prototype.sql = function() {
    var aggregationSql = [
        'SELECT count(*) AS count,',
        '{_column}',
        'FROM ({_sql}) _cdb_aggregation',
        'GROUP BY {_column}',
        'ORDER BY count DESC'
    ].join(' ');

    return format(aggregationSql, {
        _column: this.column,
        _sql: this.layerSql
    });
};

Aggregation.prototype.format = function(result) {
    return result.rows;
};
