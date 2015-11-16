var queue = require('queue-async');

function BaseWidget() {}

module.exports = BaseWidget;

BaseWidget.prototype.getResult = function(psql, filters, override, callback) {
    var self = this;
    var query = self.sql(filters, override);

    psql.query(query, function(err, result) {

        if (err) {
            return callback(err, result);
        }

        result = self.format(result, override);
        result.type = self.getType();

        return callback(null, result);

    }, true); // use read-only transaction
};
