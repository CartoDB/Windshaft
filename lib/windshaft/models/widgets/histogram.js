var _ = require('underscore');
var format = require('../../utils/format');
var BaseWidget = require('./base');
var QueryBuilder = require('../filters/query_builder');
var debug = require('debug')('windshaft:widget:histogram');

var dot = require('dot');
dot.templateSettings.strip = false;

var BIN_MIN_NUMBER = 6;
var BIN_MAX_NUMBER = 24;

var basicsQueryTpl = dot.template([
    'basics AS (',
    '  SELECT max({{=it._column}}) AS max_val, min({{=it._column}}) AS min_val, count(1) AS total_rows',
    '  FROM ({{=it._query}}) _cdb_basics',
    ')'
].join(' \n'));

var overrideBasicsQueryTpl = dot.template([
    'basics AS (',
    '  SELECT max({{=it._end}}) AS max_val, min({{=it._start}}) AS min_val, count(1) AS total_rows',
    '  FROM ({{=it._query}}) _cdb_basics',
    ')'
].join('\n'));

var iqrQueryTpl = dot.template([
    'iqrange AS (',
    '  SELECT max(quartile_max) - min(quartile_max) AS iqr',
    '  FROM (',
    '    SELECT quartile, max({{=it._column}}) AS quartile_max from (',
    '      SELECT {{=it._column}}, ntile(4) over (order by {{=it._column}}',
    '    ) AS quartile',
    '    FROM ({{=it._query}}) _cdb_rank) _cdb_quartiles',
    '    WHERE quartile = 1 or quartile = 3',
    '    GROUP BY quartile',
    '  ) _cdb_iqr',
    ')'
].join('\n'));

var binsQueryTpl = dot.template([
    'bins AS (',
    '  SELECT CASE WHEN total_rows = 0 OR iqr = 0',
    '      THEN 1',
    '      ELSE GREATEST(',
    '        {{=it._minBins}},',
    '        LEAST(',
    '          CAST(((max_val - min_val) / (2 * iqr * power(total_rows, 1/3))) AS INT),',
    '          {{=it._maxBins}}',
    '        )',
    '      )',
    '    END AS bins_number',
    '  FROM basics, iqrange, ({{=it._query}}) _cdb_bins',
    '  LIMIT 1',
    ')'
].join('\n'));

var overrideBinsQueryTpl = dot.template([
    'bins AS (',
    '  SELECT {{=it._bins}} AS bins_number',
    ')'
].join('\n'));

var nullsQueryTpl = dot.template([
    'nulls AS (',
    '  SELECT',
    '  count(*) AS nulls_count',
    '  FROM ({{=it._query}}) _cdb_histogram_nulls',
    '  WHERE {{=it._column}} IS NULL',
    ')'
].join('\n'));

var histogramQueryTpl = dot.template([
    'SELECT',
    '    (max_val - min_val) / cast(bins_number as float) AS bin_width,',
    '    bins_number,',
    '    nulls_count,',
    '    CASE WHEN min_val = max_val',
    '      THEN 0',
    '      ELSE LEAST(WIDTH_BUCKET({{=it._column}}, min_val, max_val, bins_number), bins_number) - 1',
    '    END AS bin,',
    '    min({{=it._column}})::numeric AS min,',
    '    max({{=it._column}})::numeric AS max,',
    '    count(*) AS freq',
    'FROM ({{=it._query}}) _cdb_histogram, basics, nulls, bins',
    'WHERE {{=it._column}} IS NOT NULL',
    'GROUP BY bin, bins_number, bin_width, nulls_count',
    'ORDER BY bin'
].join('\n'));


var TYPE = 'histogram';

/**
 {
     type: 'histogram',
     options: {
         column: 'name',
         bins: 10 // OPTIONAL
     }
 }
 */
function Histogram(query, options) {
    if (!_.isString(options.column)) {
        throw new Error('Histogram expects `column` in widget options');
    }

    BaseWidget.apply(this);

    this.query = query;
    this.column = options.column;
    this.bins = options.bins || 10;
}

Histogram.prototype = new BaseWidget();
Histogram.prototype.constructor = Histogram;

module.exports = Histogram;

Histogram.prototype.sql = function(filters, override) {
    var _query = QueryBuilder.getSql(this.query, filters);

    var basicsQuery, binsQuery;

    if (override && _.has(override, 'start') && _.has(override, 'end') && _.has(override, 'bins')) {
        debug('overriding with %j', override);
        basicsQuery = overrideBasicsQueryTpl({
            _query: _query,
            _start: override.start,
            _end: override.end
        });

        binsQuery = [
            overrideBinsQueryTpl({
                _bins: override.bins
            })
        ].join(',\n');
    } else {
        basicsQuery = basicsQueryTpl({
            _query: _query,
            _column: this.column
        });

        binsQuery = [
            iqrQueryTpl({
                _query: _query,
                _column: this.column
            }),
            binsQueryTpl({
                _query: _query,
                _minBins: BIN_MIN_NUMBER,
                _maxBins: BIN_MAX_NUMBER
            })
        ].join(',\n');
    }


    var histogramSql = [
        "WITH",
        [
            basicsQuery,
            binsQuery,
            nullsQueryTpl({
                _query: _query,
                _column: this.column
            })
        ].join(',\n'),
        histogramQueryTpl({
            _query: _query,
            _column: this.column
        })
    ].join('\n');

    debug(histogramSql);

    return histogramSql;
};

Histogram.prototype.format = function(result, override) {
    override = override || {};
    var buckets = [];

    var binsCount = 0;
    var width = 0;
    var nulls = 0;
    var binsStart = 0;

    if (result.rows.length) {
        var firstRow = result.rows[0];
        binsCount = firstRow.bins_number;
        width = firstRow.bin_width;
        nulls = firstRow.nulls_count;
        binsStart = override.hasOwnProperty('start') ? override.start : firstRow.min;

        buckets = result.rows.map(function(row) {
            return _.omit(row, 'bins_number', 'bin_width', 'nulls_count');
        });
    }

    return {
        bin_width: width,
        bins_count: binsCount,
        bins_start: binsStart,
        bins: buckets,
        nulls: nulls
    };
};

Histogram.prototype.getType = function() {
    return TYPE;
};

Histogram.prototype.toString = function() {
    return format('[{_type} widget] (column={_column}, bins={_bins}) {_query}', {
        _type: TYPE,
        _query: this.query,
        _column: this.column,
        _bins: this.bins
    });
};
