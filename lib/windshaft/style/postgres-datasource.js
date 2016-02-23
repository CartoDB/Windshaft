'use strict';

var dot = require('dot');
dot.templateSettings.strip = false;

function createTemplate(method) {
    return dot.template([
        'SELECT',
        method,
        'FROM ({{=it._sql}}) _table_sql WHERE {{=it._column}} IS NOT NULL'
    ].join('\n'));
}

var methods = {
    quantiles: 'CDB_QuantileBins(array_agg(distinct({{=it._column}}::numeric)), {{=it._buckets}}) as quantiles',
    equal: 'CDB_EqualIntervalBins(array_agg({{=it._column}}::numeric), {{=it._buckets}}) as equal',
    jenks: 'CDB_JenksBins(array_agg(distinct({{=it._column}}::numeric)), {{=it._buckets}}) as jenks',
    headtails: 'CDB_HeadsTailsBins(array_agg(distinct({{=it._column}}::numeric)), {{=it._buckets}}) as headtails'
};

var methodTemplates = Object.keys(methods).reduce(function(methodTemplates, methodName) {
    methodTemplates[methodName] = createTemplate(methods[methodName]);
    return methodTemplates;
}, {});

function PostgresDatasource (psql, query) {
    this.psql = psql;
    this.query = query;
}

PostgresDatasource.prototype.getName = function () {
    return 'PostgresDatasource';
};

PostgresDatasource.prototype.getRamp = function (column, buckets, method, callback) {
    var methodName = methods.hasOwnProperty(method) ? method : 'quantiles';
    var template = methodTemplates[methodName];

    var q = template({ _column: column, _sql: this.query, _buckets: buckets });

    this.psql.query(q, function (err, result) {
        if (err) {
            return callback(err);
        }

        var ramp = result.rows[0][methodName].sort(function(a, b) {
            return a - b;
        });

        return callback(null, ramp);
    });
};

module.exports = PostgresDatasource;
