var _ = require('underscore');
var format = require('../../utils/format');

/**
 {
     type: 'histogram',
     options: {
         column: 'name',
         bins: 10 // OPTIONAL
     }
 }
 */
function Histogram(histogramOptions, layerOptions) {
    layerOptions = layerOptions || {};

    if (!_.isString(histogramOptions.column)) {
        throw new Error('Histogram expects `column` in widget options');
    }

    if (!_.isString(layerOptions.sql)) {
        throw new Error('Histogram expects `sql` query in layer options');
    }

    this.column = histogramOptions.column;
    this.layerSql = layerOptions.sql;
}

module.exports = Histogram;

Histogram.prototype.sql = function() {
    var histogramSql = [
        "WITH width AS (",
        "    SELECT min({_column}) AS min, max({_column}) AS max, {_bins} AS buckets",
        "    FROM ({_sql}) _cdb_histogram",
        ")",
        "SELECT",
        "    width_bucket({_column}, min, max, buckets) AS bucket,",
        "    numrange(min({_column})::numeric, max({_column})::numeric, '[]') AS range,",
        "    count(*) AS freq",
        "FROM ({_sql}) _cdb_histogram, width",
        "GROUP BY bucket",
        "ORDER BY bucket"
    ].join(' ');

    return format(histogramSql, {
        _sql: this.layerSql,
        _column: this.column,
        _bins: 10
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
