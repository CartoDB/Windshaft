var _ = require('underscore');
var format = require('../../utils/format');
var BaseWidget = require('./base');
var QueryBuilder = require('../filters/query_builder');

var VALID_OPERATIONS = {
    count: true
};

var TYPE = 'aggregation';

/**
 {
     type: 'aggregation',
     options: {
         column: 'name',
         aggregation: 'count' // it could be, e.g., sum if column is numeric
     }
 }
 */
function Aggregation(query, options) {
    if (!_.isString(options.column)) {
        throw new Error('Aggregation expects `column` in widget options');
    }

    if (!_.isString(options.aggregation)) {
        throw new Error('Aggregation expects `aggregation` operation in widget options');
    }

    if (!VALID_OPERATIONS[options.aggregation]) {
        throw new Error("Aggregation does not support '" + options.aggregation + "' operation");
    }

    BaseWidget.apply(this);

    this.query = query;
    this.column = options.column;
    this.aggregation = options.aggregation;
}

Aggregation.prototype = new BaseWidget();
Aggregation.prototype.constructor = Aggregation;

module.exports = Aggregation;

Aggregation.prototype.sql = function(filters) {
    var aggregationSql = [
        'SELECT count(*) AS count,',
        '{_column}',
        'FROM ({_query}) _cdb_aggregation',
        'GROUP BY {_column}',
        'ORDER BY count DESC'
    ].join(' ');

    return format(aggregationSql, {
        _query: QueryBuilder.getSql(this.query, filters),
        _column: this.column
    });
};

Aggregation.prototype.format = function(result) {
    return {
        categories: result.rows
    };
};

Aggregation.prototype.getType = function() {
    return TYPE;
};

Aggregation.prototype.toString = function() {
    return format('[{_type} widget] (column={_column}, aggregation={_aggregation}) {_query}', {
        _type: TYPE,
        _query: this.query,
        _column: this.column,
        _aggregation: this.aggregation
    });
};
