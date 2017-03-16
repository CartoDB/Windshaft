'use strict';

var fs = require('fs');
var dot = require('dot');
dot.templateSettings.strip = false;
var geojsonSQL = fs.readFileSync(__dirname + '/geojson_template.sql', 'utf8');

function GeojsonSqlWrapper() {
    this.geojsonTemplate = dot.template(geojsonSQL);
}

module.exports = GeojsonSqlWrapper;

GeojsonSqlWrapper.prototype.wrap = function (queryContext) {
    return this.geojsonTemplate(queryContext);
};
