var _ = require('underscore');
var format = require('../../utils/format');
var dot = require('dot');
var BaseWidget = require('./base');
var QueryBuilder = require('../filters/query_builder');

var summaryQueryTpl = dot.template([
    'summary AS (',
    '  SELECT',
    '  count(1) AS count,',
    '  sum(CASE WHEN {{=it._column}} IS NULL THEN 1 ELSE 0 END) AS nulls_count',
    '  FROM ({{=it._query}}) _cdb_aggregation_nulls',
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

var categoriesSummaryQueryTpl = dot.template([
    'categories_summary AS(',
    '  SELECT count(1) categories_count, max(value) max_val, min(value) min_val',
    '  FROM categories',
    ')'
].join(' '));

var aggregationQueryTpl = dot.template([
    'SELECT CAST(category AS text), value, false as agg, nulls_count, min_val, max_val, count, categories_count',
    '  FROM categories, summary, categories_summary',
    '  WHERE rank < {{=it._limit}}',
    'UNION ALL',
    'SELECT \'Other\' category, sum(value), true as agg, nulls_count, min_val, max_val, count, categories_count',
    '  FROM categories, summary, categories_summary',
    '  WHERE rank >= {{=it._limit}}',
    'GROUP BY nulls_count, min_val, max_val, count, categories_count'
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
            }),
            categoriesSummaryQueryTpl({
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
    var count = 0;
    var nulls = 0;
    var minValue = 0;
    var maxValue = 0;
    var categoriesCount = 0;


    if (result.rows.length) {
        var firstRow = result.rows[0];
        count = firstRow.count;
        nulls = firstRow.nulls_count;
        minValue = firstRow.min_val;
        maxValue = firstRow.max_val;
        categoriesCount = firstRow.categories_count;

        result.rows.forEach(function(row) {
            categories.push(_.omit(row, 'count', 'nulls_count', 'min_val', 'max_val', 'categories_count'));
        });
    }

    return {
        count: count,
        nulls: nulls,
        min: minValue,
        max: maxValue,
        categoriesCount: categoriesCount,
        categories: categories
    };
};

var searchCategoriesQueryTpl = dot.template([
    'SELECT {{=it._column}} AS category, count(1) AS value',
    'FROM ({{=it._query}}) _cdb_aggregation_search',
    'WHERE {{=it._column}} ILIKE {{=it._userQuery}}',
    'GROUP BY {{=it._column}}',
    'ORDER BY 2 DESC',
    'LIMIT 100'
].join(' '));

Aggregation.prototype.search = function(psql, userQuery, callback) {
    var self = this;

    var query = searchCategoriesQueryTpl({
        _query: this.query,
        _column: this.column,
        _userQuery: psql.escapeLiteral('%' + userQuery + '%')
    });
    console.log(query);
    psql.query(query, function(err, result) {
        if (err) {
            return callback(err, result);
        }

        result = self.format(result);
        result.type = self.getType();

        return callback(null, result);
    }, true); // use read-only transaction
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
