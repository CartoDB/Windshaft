'use strict';

var fs = require('fs');
var _ = require('underscore');
var geoJSONSQL = fs.readFileSync(__dirname + '/geojson_template.sql', 'utf8');

function GeoJsonSqlWrapper() {
    this.geoJSONTemplate = _.template(geoJSONSQL);
}

GeoJsonSqlWrapper.prototype.wrap = function (queryContext) {
    return this.geoJSONTemplate(queryContext);
};

module.exports = GeoJsonSqlWrapper;
