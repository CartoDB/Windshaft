var dot = require('dot');

//var providerKey = '{{=it.authToken}}:{{=it.configHash}}:{{=it.format}}:{{=it.layer}}:{{=it.scale_factor}}';
var filterQueryTpl = dot.template('SELECT * FROM ({{=it._sql}}) _cdb_category_filter WHERE {{=it._filters}}');
var escapeStringTpl = dot.template("$string_{{=it._i}}${{=it._value}}$string_{{=it._i}}$");
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

    filterParams.accept = filterParams.accept || [];
    filterParams.reject = filterParams.reject || [];

    if (filterParams.accept.length === 0 && filterParams.reject.length === 0) {
        throw new Error('Category filter expects to have at least one value in accept or reject arrays');
    }

    this.accept = filterParams.accept;
    this.reject = filterParams.reject;
}

module.exports = Category;

Category.prototype.sql = function(rawSql) {
    var valueFilters = [];

    if (Array.isArray(this.accept) && this.accept.length > 0) {
        valueFilters.push(inConditionTpl({
            _column: this.column,
            _values: this.accept.map(function(value, i) {
                return Number.isFinite(value) ? value : escapeStringTpl({_i: i, _value: value});
            }).join(',')
        }));
    }

    if (Array.isArray(this.reject) && this.reject.length > 0) {
        valueFilters.push(notInConditionTpl({
            _column: this.column,
            _values: this.reject.map(function(value, i) {
                return Number.isFinite(value) ? value : escapeStringTpl({_i: i, _value: value});
            }).join(',')
        }));
    }

    return filterQueryTpl({
        _sql: rawSql,
        _filters: valueFilters.join(' AND ')
    });
};
