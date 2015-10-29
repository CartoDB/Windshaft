var _ = require('underscore');
var format = require('../../utils/format');
var base = require('./base');

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
function Histogram(histogramOptions, layerOptions, bbox) {
    layerOptions = layerOptions || {};

    if (!_.isString(histogramOptions.column)) {
        throw new Error('Histogram expects `column` in widget options');
    }

    if (!_.isString(layerOptions.sql)) {
        throw new Error('Histogram expects `sql` query in layer options');
    }

    this.column = histogramOptions.column;
    this.layerSql = base.bboxSql(layerOptions.sql, bbox);
    this.bins = histogramOptions.bins || 10;
}

module.exports = Histogram;

Histogram.prototype.sql = function() {
    var histogramSql = [
        "WITH width AS (",
        "    SELECT",
        "        min({_column}) AS min,",
        "        max({_column}) AS max,",
        "        (max({_column}) - min({_column})) / {_bins} AS bin_width,",
        "        {_bins} AS buckets",
        "    FROM ({_sql}) _cdb_histogram",
        ")",
        "SELECT",
        "    bin_width,",
        "    buckets,",
        "    width_bucket({_column}, min, max, buckets - 1) - 1 AS bin,",
        "    min({_column})::numeric AS min,",
        "    max({_column})::numeric AS max,",
        "    count(*) AS freq",
        "FROM ({_sql}) _cdb_histogram, width",
        "GROUP BY bin, buckets, bin_width",
        "ORDER BY bin"
    ].join('\n');

    return format(histogramSql, {
        _sql: this.layerSql,
        _column: this.column,
        _bins: this.bins
    });
};

Histogram.prototype.format = function(result) {
    var buckets = [];
    var width = null;

    if (result.rows.length) {
        var firstRow = result.rows[0];
        var bins = firstRow.buckets;
        width = firstRow.bin_width;

        buckets = new Array(bins);
        result.rows.forEach(function(row) {
            buckets[row.bin] = _.omit(row, 'buckets', 'bin_width');
        });
    }

    return {
        type: TYPE,
        bins: buckets,
        width: width
    };
};

/* for a categorical histogram we will do something like
 SELECT count(*) AS count,
 {_column}
 FROM ({_sql}) _cdb_histogram
 GROUP BY {_column}
 ORDER BY count
 -- DESC LIMIT 10;
 */
