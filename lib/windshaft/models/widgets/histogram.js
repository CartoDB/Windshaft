var _ = require('underscore');
var format = require('../../utils/format');
var BaseWidget = require('./base');
var QueryBuilder = require('../filters/query_builder');

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
    override = override || {};
    var histogramSql = [
        "WITH width AS (",
        "    SELECT",
        "        {_start} AS _start,",
        "        {_end} AS _end,",
        "        {_bins} AS buckets",
        "    FROM ({_query}) _cdb_histogram",
        ")",
        "SELECT",
        "    (_end - _start) / cast({_bins} as float) AS bin_width,",
        "    buckets,",
        "    width_bucket({_column}, _start, _end, buckets - 1) - 1 AS bin,",
        "    min({_column})::numeric AS min,",
        "    max({_column})::numeric AS max,",
        "    count(*) AS freq",
        "FROM ({_query}) _cdb_histogram, width",
        "GROUP BY bin, buckets, bin_width",
        "ORDER BY bin"
    ].join('\n');

    return format(histogramSql,
        {
            _start: override.start || 'min({_column})',
            _end: override.end || 'max({_column})'
        },
        {
            _query: QueryBuilder.getSql(this.query, filters),
            _column: this.column,
            _bins: this.bins
        }
    );
};

Histogram.prototype.format = function(result) {
    var buckets = [];
    var width = null;

    if (result.rows.length) {
        var firstRow = result.rows[0];
        width = firstRow.bin_width;
        var start = firstRow.min;

        buckets = new Array(this.bins);
        result.rows.forEach(function(row) {
            buckets[row.bin] = _.omit(row, 'buckets', 'bin_width');
        });

        for (var i = 0; i < this.bins; i++) {
            var binStart = start + (i * width);
            var binEnd = start + ((i + 1) * width);
            buckets[i] = _.extend({ bin: i, start: binStart, end: binEnd, freq: 0 }, buckets[i]);
        }
    }

    return {
        bins: buckets,
        width: width
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


/* for a categorical histogram we will do something like
 SELECT count(*) AS count,
 {_column}
 FROM ({_sql}) _cdb_histogram
 GROUP BY {_column}
 ORDER BY count
 -- DESC LIMIT 10;
 */
