'use strict';

var queue = require('queue-async');
var turboCartoCss = require('turbo-cartocss');
var PostgresDatasource = require('./postgres-datasource');

function TurboCartocssParser (psql) {
    this.psql = psql;
}

TurboCartocssParser.prototype.process = function (cartocss, sql, callback) {
    var self = this;

    if (!Array.isArray(cartocss)) {
        cartocss = [ cartocss ];
    }

    if (!Array.isArray(sql)) {
        sql = [ sql ];
    }

    var parseQueue = queue(cartocss.length);

    cartocss.forEach(function(css, index) {
        var datasource = new PostgresDatasource(self.psql, sql[index]);
        parseQueue.defer(turboCartoCss.bind(turboCartoCss), css, datasource);
    });

    parseQueue.awaitAll(callback);
};

module.exports = TurboCartocssParser;
