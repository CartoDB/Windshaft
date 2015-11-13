var _ = require('underscore');
var format = require('../../utils/format');
var dot = require('dot');
var BaseWidget = require('./base');
var QueryBuilder = require('../filters/query_builder');

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
].join(' \n'));

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
].join(' \n'));

var binsQueryTpl = dot.template([
    'bins AS (',
    '  SELECT GREATEST(4, LEAST(cast(((max_val - min_val) / (2 * iqr * power(total_rows, 1/3))) as int), 20)) AS bins_number',
    '  FROM basics, iqrange, ({{=it._query}}) _cdb_bins',
    '  LIMIT 1',
    ')'
].join(' \n'));

var overrideBinsQueryTpl = dot.template([
    'bins AS (',
    '  SELECT {{=it._bins}} AS bins_number',
    ')'
].join(' \n'));

var nullsQueryTpl = dot.template([
    'nulls AS (',
    '  SELECT',
    '  count(*) AS nulls_count',
    '  FROM ({{=it._query}}) _cdb_histogram_nulls',
    '  WHERE {{=it._column}} IS NULL',
    ')'
].join(' \n'));

var histogramQueryTpl = dot.template([
    'SELECT',
    '    (max_val - min_val) / cast(bins_number as float) AS bin_width,',
    '    bins_number,',
    '    nulls_count,',
    '    width_bucket({{=it._column}}, min_val, max_val, bins_number - 1) - 1 AS bin,',
    '    min({{=it._column}})::numeric AS min,',
    '    max({{=it._column}})::numeric AS max,',
    '    count(*) AS freq',
    'FROM ({{=it._query}}) _cdb_histogram, basics, nulls, bins',
    'WHERE {{=it._column}} IS NOT NULL',
    'GROUP BY bin, bins_number, bin_width, nulls_count',
    'ORDER BY bin'
].join(' \n'));


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

    if (_.has(override, 'start', 'end', 'bins')) {
        console.log('overriding with %j', override);
        basicsQuery = overrideBasicsQueryTpl({
            _query: _query,
            _start: override.start,
            _end: override.end
        });

        binsQuery = [
            overrideBinsQueryTpl({
                _bins: override.bins
            })
        ].join(',');

//        binsQuery = [
//            iqrQueryTpl({
//                _query: _query,
//                _column: this.column
//            }),
//            binsQueryTpl({
//                _query: _query
//            })
//        ].join(',');

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
                _query: _query
            })
        ].join(',');
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
//
//    var query = format(histogramSql,
//        {
//            _start: override.hasOwnProperty('start') ? override.start : '{_column}',
//            _end: override.hasOwnProperty('end') ? override.end : '{_column}'
//        },
//        {
//            _query: QueryBuilder.getSql(this.query, filters),
//            _column: this.column,
//            _bins: this.bins
//        }
//    );

    console.log(histogramSql);

    return histogramSql;
};

Histogram.prototype.format = function(result, override) {
    override = override || {};
    var buckets = [];
    var nulls = 0;
    var numberOfBins;

    if (result.rows.length) {
        var firstRow = result.rows[0];
        numberOfBins = firstRow.bins_number;
        var width = firstRow.bin_width;
        nulls = firstRow.nulls_count;
        var start = override.hasOwnProperty('start') ? override.start : firstRow.min;

        buckets = new Array(numberOfBins);
        result.rows.forEach(function(row) {
            buckets[row.bin] = _.omit(row, 'bins_number', 'bin_width', 'nulls_count');
        });

        for (var i = 0; i < numberOfBins; i++) {
            var binStart = start + (i * width);
            var binEnd = start + ((i + 1) * width);
            buckets[i] = _.extend({ bin: i, start: binStart, end: binEnd, freq: 0 }, buckets[i]);
        }
    }

    return {
        bins: buckets,
        nulls: nulls
    };
};

Histogram.prototype.getResult = function(psql, filters, override, callback) {
    var self = this;
    var query = self.sql(filters, override);

    psql.query(query, function(err, result) {

        if (err) {
            return callback(err, result);
        }

        result = self.format(result, override);
        result.type = self.getType();

        return callback(null, result);

    }, true); // use read-only transaction
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


/* for a categorical histogram we will do something like
 SELECT count(*) AS count,
 {_column}
 FROM ({_sql}) _cdb_histogram
 GROUP BY {_column}
 ORDER BY count
 -- DESC LIMIT 10;
 */
