'use strict';

var fs = require('fs');
var _ = require('underscore');
var geojsonSQL = fs.readFileSync(__dirname + '/geojson_template.sql', 'utf8');

function GeojsonSqlWrapper() {
    this.geojsonTemplate = _.template(geojsonSQL);
}

module.exports = GeojsonSqlWrapper;

GeojsonSqlWrapper.prototype.wrap = function (queryContext) {
    return this.geojsonTemplate(queryContext);
};
