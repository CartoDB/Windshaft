var debug = require('debug')('windshaft:filter:category');
var dot = require('dot');
dot.templateSettings.strip = false;

var filterQueryTpl = dot.template([
    'SELECT *',
    'FROM ({{=it._sql}}) _cdb_category_filter',
    'WHERE {{=it._filters}}'
].join('\n'));
var escapeStringTpl = dot.template("$escape_{{=it._i}}${{=it._value}}$escape_{{=it._i}}$");
var inConditionTpl = dot.template('{{=it._column}} IN ({{=it._values}})');
var notInConditionTpl = dot.template('{{=it._column}} NOT IN ({{=it._values}})');


/**
 Definition
 {
     “type”: “aggregation”,
     “options”: {
         “column”: “country”,
         “aggregation”: “count”
     }
 }

 Params
 {
     “accept”: [“Spain”, “Germany”]
     “reject”: [“Japan”]
 }
 */
function Category(filterDefinition, filterParams) {
    this.column = filterDefinition.options.column;

    if (!Array.isArray(filterParams.accept) && !Array.isArray(filterParams.reject)) {
        throw new Error('Category filter expects at least one array in accept or reject params');
    }

    if (Array.isArray(filterParams.accept) && Array.isArray(filterParams.reject)) {
        if (filterParams.accept.length === 0 && filterParams.accept.length === 0) {
            throw new Error(
                'Category filter expects one value either in accept or reject params when both are provided'
            );
        }
    }

    this.accept = filterParams.accept;
    this.reject = filterParams.reject;
}

module.exports = Category;

/*
 - accept: [] => reject all
 - reject: [] => accept all
 */
Category.prototype.sql = function(rawSql) {
    var valueFilters = [];

    if (Array.isArray(this.accept)) {
        if (this.accept.length > 0) {
            valueFilters.push(inConditionTpl({
                _column: this.column,
                _values: this.accept.map(function(value, i) {
                    return Number.isFinite(value) ? value : escapeStringTpl({_i: i, _value: value});
                }).join(',')
            }));
        } else {
            valueFilters.push('0 = 1');
        }
    }

    if (Array.isArray(this.reject)) {
        if (this.reject.length > 0) {
            valueFilters.push(notInConditionTpl({
                _column: this.column,
                _values: this.reject.map(function (value, i) {
                    return Number.isFinite(value) ? value : escapeStringTpl({_i: i, _value: value});
                }).join(',')
            }));
        } else {
            valueFilters.push('1 = 1');
        }
    }

    debug(filterQueryTpl({
        _sql: rawSql,
        _filters: valueFilters.join(' AND ')
    }));

    return filterQueryTpl({
        _sql: rawSql,
        _filters: valueFilters.join(' AND ')
    });
};
