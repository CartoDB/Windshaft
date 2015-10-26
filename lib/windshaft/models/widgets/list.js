var _ = require('underscore');

/**
{
    type: 'list',
    options: {
        columns: ['name', 'description']
    }
}
*/

function List(listOptions, layerOptions) {
    listOptions = listOptions || {};
    layerOptions = layerOptions || {};

    if (!Array.isArray(listOptions.columns)) {
        throw new Error('List expects `columns` array in widget options');
    }

    if (!_.isString(layerOptions.sql)) {
        throw new Error('List expects `sql` query in layer options');
    }

    this.columns = listOptions.columns;
    this.layerSql = layerOptions.sql;
}

module.exports = List;
module.exports.type = 'list';

List.prototype.sql = function() {
    return 'select ' + this.columns.join(', ') + ' from ( ' + this.layerSql + ' ) as _windshaft_subquery';
};
