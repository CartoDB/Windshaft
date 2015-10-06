var _ = require('underscore');

function List(config, altSql) {
    this.config = _.defaults({}, config, {
        sql: altSql,
        columns: ['*']
    });
}

module.exports = List;

List.prototype.sql = function() {
    return this.config.sql;
};

List.prototype.columns = function() {
    return this.config.columns;
};

List.prototype.getConfig = function() {
    return this.config;
};
