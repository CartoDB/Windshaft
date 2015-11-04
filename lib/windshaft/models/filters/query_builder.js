module.exports.getSql = function QueryBuilder$getSql(query, filters) {
    filters = filters || [];
    return filters.reduce(function(sql, filter) {
        return filter.sql(sql);
    }, query);
};