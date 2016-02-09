var _ = require('underscore');
var format = require('../../utils/format');
var BaseWidget = require('./base');
var QueryBuilder = require('../filters/query_builder');
var debug = require('debug')('windshaft:widget:formula');

var dot = require('dot');
dot.templateSettings.strip = false;

var formulaQueryTpl = dot.template([
    'SELECT',
    '{{=it._operation}}({{=it._column}}) AS result,',
    '(SELECT count(1) FROM ({{=it._query}}) _cdb_formula_nulls WHERE {{=it._column}} IS NULL) AS nulls_count',
    'FROM ({{=it._query}}) _cdb_formula'
].join('\n'));

var VALID_OPERATIONS = {
    count: true,
    avg: true,
    sum: true,
    min: true,
    max: true
};

var TYPE = 'formula';

/**
 {
     type: 'formula',
     options: {
         column: 'name',
         operation: 'count' // count, sum, avg
     }
 }
 */
function Formula(query, options) {
    if (!_.isString(options.operation)) {
        throw new Error('Formula expects `operation` in widget options');
    }

    if (!VALID_OPERATIONS[options.operation]) {
        throw new Error("Formula does not support '" + options.operation + "' operation");
    }

    if (options.operation !== 'count' && !_.isString(options.column)) {
        throw new Error('Formula expects `column` in widget options');
    }

    BaseWidget.apply(this);

    this.query = query;
    this.column = options.column || '1';
    this.operation = options.operation;
}

Formula.prototype = new BaseWidget();
Formula.prototype.constructor = Formula;

module.exports = Formula;

Formula.prototype.sql = function(psql, filters, override, callback) {
    if (!callback) {
        callback = override;
        override = {};
    }

    var _query = QueryBuilder.getSql(this.query, filters);
    var formulaSql = formulaQueryTpl({
        _query: _query,
        _operation: this.operation,
        _column: this.column
    });

    debug(formulaSql);

    return callback(null, formulaSql);
};

Formula.prototype.format = function(result) {
    var formattedResult = {
        operation: this.operation,
        result: 0,
        nulls: 0
    };

    if (result.rows.length) {
        formattedResult.operation = this.operation;
        formattedResult.result = result.rows[0].result;
        formattedResult.nulls = result.rows[0].nulls_count;
    }

    return formattedResult;
};

Formula.prototype.getType = function() {
    return TYPE;
};

Formula.prototype.toString = function() {
    return format('[{_type} widget] (column={_column}, aggregation={_operation}) {_query}', {
        _type: TYPE,
        _query: this.query,
        _column: this.column,
        _operation: this.operation
    });
};
