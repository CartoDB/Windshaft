var format = require('../../utils/format');
var BaseWidget = require('./base');
var QueryBuilder = require('../filters/query_builder');

var TYPE = 'list';

/**
{
    type: 'list',
    options: {
        columns: ['name', 'description']
    }
}
*/

function List(query, options) {
    options = options || {};

    if (!Array.isArray(options.columns)) {
        throw new Error('List expects `columns` array in widget options');
    }

    BaseWidget.apply(this);

    this.query = query;
    this.columns = options.columns;
}

List.prototype = new BaseWidget();
List.prototype.constructor = List;

module.exports = List;

List.prototype.sql = function(psql, filters, override, callback) {
    if (!callback) {
        callback = override;
    }

    var listSql = format('select {_columns} from ({_query}) as _cdb_list', {
        _query: QueryBuilder.getSql(this.query, filters),
        _columns: this.columns.join(', ')
    });

    return callback(null, listSql);
};

List.prototype.format = function(result) {
    return {
        rows: result.rows
    };
};

List.prototype.getType = function() {
    return TYPE;
};

List.prototype.toString = function() {
    return format('[{_type} widget] (columns=[{_columns}]) {_query}', {
        _type: TYPE,
        _query: this.query,
        _columns: this.columns.join(', ')
    });
};
