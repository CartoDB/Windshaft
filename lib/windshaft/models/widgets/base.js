var queue = require('queue-async');

function BaseWidget() {}

module.exports = BaseWidget;

BaseWidget.prototype.getResult = function(psql, allFilters, noOwnFilters, override, callback) {
    var filters = [allFilters, noOwnFilters];

    var self = this;

    var filtersQueue = queue(2);
    filters.forEach(function(filter) {
        filtersQueue.defer(function(filter, done) {
            psql.query(self.sql(filter, override), done, true); // use read-only transaction
        }, filter);
    });

    function filtersQueueFinish(err, results) {
        if (err) {
            return callback(err, results);
        }

        results = results.map(self.format.bind(self));

        return callback(null, { type: self.getType(), ownFilterOn: results[0], ownFilterOff: results[1] });
    }

    filtersQueue.awaitAll(filtersQueueFinish);
};
