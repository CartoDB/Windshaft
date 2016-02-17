'use strict';

function PostgresDatasource (psql, query) {
    this.psql = psql;
    this.query = query;
}

PostgresDatasource.prototype.getName = function () {
    return 'PostgresDatasource';
};

PostgresDatasource.prototype.getRamp = function (column, method, callback) {
    var methods = {
        quantiles: 'CDB_QuantileBins(array_agg(distinct({{column}}::numeric)), 5) as quantiles',
        equal: 'CDB_EqualIntervalBins(array_agg({{column}}::numeric), 5) as equal',
        jenks: 'CDB_JenksBins(array_agg(distinct({{column}}::numeric)), 5) as jenks',
        headtails: 'CDB_HeadsTailsBins(array_agg(distinct({{column}}::numeric)), 5) as headtails'
    };

    var sql = [
      'select',
      methods[method] || methods.quantiles,
      'from ({{sql}}) _table_sql where {{column}} is not null'
    ].join('\n');

    var q = format(sql, { column: column, sql: this.query});

    this.psql.query(q, function (err, result) {
        if (err) {
            return callback(err);
        }
        callback(null, result[method]);
    });
};

function format (str) {
  var replacements = Array.prototype.slice.call(arguments, 1);

  replacements.forEach(function (attrs) {
    Object.keys(attrs).forEach(function (attr) {
      str = str.replace(new RegExp('\\{\\{' + attr + '\\}\\}', 'g'), attrs[attr]);
    });
  });

  return str;
}

module.exports = PostgresDatasource;
