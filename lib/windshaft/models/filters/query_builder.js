module.exports.getSql = function QueryBuilder$getSql(query, filters, override) {
    filters = filters || [];
    return filters.reduce(function(sql, filter) {
        return filter.sql(sql, override);
    }, query);
};
