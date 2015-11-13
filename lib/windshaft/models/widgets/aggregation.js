var _ = require('underscore');
var format = require('../../utils/format');
var dot = require('dot');
var BaseWidget = require('./base');
var QueryBuilder = require('../filters/query_builder');

var summaryQueryTpl = dot.template([
    'summary AS (',
    '  SELECT',
    '  count(*) AS nulls_count',
    '  FROM ({{=it._query}}) _cdb_aggregation_nulls',
    '  WHERE {{=it._column}} IS NULL',
    ')'
].join(' \n'));

var categoriesQueryTpl = dot.template([
    'categories AS(',
    '  SELECT {{=it._column}} AS category, count(1) AS value, row_number() OVER (ORDER BY count(1) desc) as rank',
    '  FROM ({{=it._query}}) _cdb_aggregation_all',
    '  GROUP BY {{=it._column}}',
    '  ORDER BY 2 DESC',
    ')'
].join(' '));

var aggregationQueryTpl = dot.template([
    'SELECT category, value, false as agg, nulls_count',
    'FROM categories, summary',
    'WHERE rank < {{=it._limit}}',
    'UNION ALL',
    'SELECT \'Other\' category, sum(value), true as agg, nulls_count',
    'FROM categories, summary',
    'WHERE rank >= {{=it._limit}}',
    'GROUP BY nulls_count'
].join(' \n'));

var CATEGORIES_LIMIT = 12;

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

    var _query = QueryBuilder.getSql(this.query, filters);

    var aggregationSql = [
        "WITH",
        [
            summaryQueryTpl({
                _query: _query,
                _column: this.column
            }),
            categoriesQueryTpl({
                _query: _query,
                _column: this.column
            })
        ].join(',\n'),
        aggregationQueryTpl({
            _query: _query,
            _column: this.column,
            _limit: CATEGORIES_LIMIT
        })
    ].join('\n');

    console.log(aggregationSql);

    return aggregationSql;
};

Aggregation.prototype.format = function(result) {
    var categories = [];
    var nulls = 0;

    if (result.rows.length) {
        var firstRow = result.rows[0];
        nulls = firstRow.nulls_count;

        result.rows.forEach(function(row) {
            categories.push(_.omit(row, 'nulls_count'));
        });
    }

    return {
        categories: categories,
        nulls: nulls
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
