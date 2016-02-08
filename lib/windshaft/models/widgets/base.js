function BaseWidget() {}

module.exports = BaseWidget;

BaseWidget.prototype.getResult = function(psql, filters, override, callback) {
    var self = this;
    this.sql(psql, filters, override, function(err, query) {
        psql.query(query, function(err, result) {

            if (err) {
                return callback(err, result);
            }

            result = self.format(result, override);
            result.type = self.getType();

            return callback(null, result);

        }, true); // use read-only transaction
    });

};

BaseWidget.prototype.search = function(psql, filters, userQuery, callback) {
    return callback(null, this.format({ rows: [] }));
};
