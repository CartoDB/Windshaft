var _ = require('underscore');
var format = require('../../utils/format');
var BaseWidget = require('./base');
var QueryBuilder = require('../filters/query_builder');
var debug = require('debug')('windshaft:widget:aggregation');

var dot = require('dot');
dot.templateSettings.strip = false;

var summaryQueryTpl = dot.template([
    'summary AS (',
    '  SELECT',
    '  count(1) AS count,',
    '  sum(CASE WHEN {{=it._column}} IS NULL THEN 1 ELSE 0 END) AS nulls_count',
    '  FROM ({{=it._query}}) _cdb_aggregation_nulls',
    ')'
].join('\n'));

var rankedCategoriesQueryTpl = dot.template([
    'categories AS(',
    '  SELECT {{=it._column}} AS category, {{=it._aggregation}} AS value,',
    '    row_number() OVER (ORDER BY {{=it._aggregation}} desc) as rank',
    '  FROM ({{=it._query}}) _cdb_aggregation_all',
    '  GROUP BY {{=it._column}}',
    '  ORDER BY 2 DESC',
    ')'
].join('\n'));

var categoriesSummaryQueryTpl = dot.template([
    'categories_summary AS(',
    '  SELECT count(1) categories_count, max(value) max_val, min(value) min_val',
    '  FROM categories',
    ')'
].join('\n'));

var rankedAggregationQueryTpl = dot.template([
    'SELECT CAST(category AS text), value, false as agg, nulls_count, min_val, max_val, count, categories_count',
    '  FROM categories, summary, categories_summary',
    '  WHERE rank < {{=it._limit}}',
    'UNION ALL',
    'SELECT \'Other\' category, sum(value), true as agg, nulls_count, min_val, max_val, count, categories_count',
    '  FROM categories, summary, categories_summary',
    '  WHERE rank >= {{=it._limit}}',
    'GROUP BY nulls_count, min_val, max_val, count, categories_count'
].join('\n'));

var aggregationQueryTpl = dot.template([
    'SELECT CAST({{=it._column}} AS text) AS category, {{=it._aggregation}} AS value, false as agg,',
    '  nulls_count, min_val, max_val, count, categories_count',
    'FROM ({{=it._query}}) _cdb_aggregation_all, summary, categories_summary',
    'GROUP BY category, nulls_count, min_val, max_val, count, categories_count',
    'ORDER BY value DESC'
].join('\n'));

var CATEGORIES_LIMIT = 6;

var VALID_OPERATIONS = {
    count: [],
    sum: ['aggregationColumn']
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

    var requiredOptions = VALID_OPERATIONS[options.aggregation];
    var missingOptions = _.difference(requiredOptions, Object.keys(options));
    if (missingOptions.length > 0) {
        throw new Error(
            "Aggregation '" + options.aggregation + "' is missing some options: " + missingOptions.join(',')
        );
    }

    BaseWidget.apply(this);

    this.query = query;
    this.column = options.column;
    this.aggregation = options.aggregation;
    this.aggregationColumn = options.aggregationColumn;
}

Aggregation.prototype = new BaseWidget();
Aggregation.prototype.constructor = Aggregation;

module.exports = Aggregation;

Aggregation.prototype.sql = function(psql, filters, override, callback) {
    if (!callback) {
        callback = override;
        override = {};
    }

    var _query = QueryBuilder.getSql(this.query, filters);

    var aggregationSql;
    if (!!override.ownFilter) {
        aggregationSql = [
            "WITH",
            [
                summaryQueryTpl({
                    _query: _query,
                    _column: this.column
                }),
                rankedCategoriesQueryTpl({
                    _query: _query,
                    _column: this.column,
                    _aggregation: this.getAggregationSql()
                }),
                categoriesSummaryQueryTpl({
                    _query: _query,
                    _column: this.column
                })
            ].join(',\n'),
            aggregationQueryTpl({
                _query: _query,
                _column: this.column,
                _aggregation: this.getAggregationSql(),
                _limit: CATEGORIES_LIMIT
            })
        ].join('\n');
    } else {
        aggregationSql = [
            "WITH",
            [
                summaryQueryTpl({
                    _query: _query,
                    _column: this.column
                }),
                rankedCategoriesQueryTpl({
                    _query: _query,
                    _column: this.column,
                    _aggregation: this.getAggregationSql()
                }),
                categoriesSummaryQueryTpl({
                    _query: _query,
                    _column: this.column
                })
            ].join(',\n'),
            rankedAggregationQueryTpl({
                _query: _query,
                _column: this.column,
                _limit: CATEGORIES_LIMIT
            })
        ].join('\n');
    }

    debug(aggregationSql);

    return callback(null, aggregationSql);
};

var aggregationFnQueryTpl = dot.template('{{=it._aggregationFn}}({{=it._aggregationColumn}})');
Aggregation.prototype.getAggregationSql = function() {
    return aggregationFnQueryTpl({
        _aggregationFn: this.aggregation,
        _aggregationColumn: this.aggregationColumn || 1
    });
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

var filterCategoriesQueryTpl = dot.template([
    'SELECT {{=it._column}} AS category, {{=it._value}} AS value',
    'FROM ({{=it._query}}) _cdb_aggregation_search',
    'WHERE CAST({{=it._column}} as text) ILIKE {{=it._userQuery}}',
    'GROUP BY {{=it._column}}'
].join('\n'));

var searchQueryTpl = dot.template([
    'WITH',
    'search_unfiltered AS (',
    '  {{=it._searchUnfiltered}}',
    '),',
    'search_filtered AS (',
    '  {{=it._searchFiltered}}',
    '),',
    'search_union AS (',
    '  SELECT * FROM search_unfiltered',
    '  UNION ALL',
    '  SELECT * FROM search_filtered',
    ')',
    'SELECT category, sum(value) AS value',
    'FROM search_union',
    'GROUP BY category',
    'ORDER BY value desc'
].join('\n'));


Aggregation.prototype.search = function(psql, filters, userQuery, callback) {
    var self = this;

    var _userQuery = psql.escapeLiteral('%' + userQuery + '%');

    var query = searchQueryTpl({
        _searchUnfiltered: filterCategoriesQueryTpl({
            _query: this.query,
            _column: this.column,
            _value: '0',
            _userQuery: _userQuery
        }),
        _searchFiltered: filterCategoriesQueryTpl({
            _query: QueryBuilder.getSql(this.query, filters),
            _column: this.column,
            _value: 'count(1)',
            _userQuery: _userQuery
        })
    });

    psql.query(query, function(err, result) {
        if (err) {
            return callback(err, result);
        }

        return callback(null, {type: self.getType(), categories: result.rows });
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
