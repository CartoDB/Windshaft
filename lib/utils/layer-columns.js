'use strict';

var cartocssUtils = require('./cartocss-utils');

var EXCLUDE_PROPERTIES = {
    'mapnik::geometry_type': true,
    'mapnik-geometry-type': true
};

module.exports.getColumns = function (layerOptions) {
    var columns = [];

    if (Array.isArray(layerOptions.columns)) {
        columns = layerOptions.columns;
    }

    if (typeof layerOptions.cartocss === 'string') {
        columns = columns.concat(cartocssUtils.getColumnNamesFromCartoCSS(layerOptions.cartocss));
    }

    columns = columns.concat(getColumnNamesFromInteractivity(layerOptions.interactivity));

    // filter out repeated ones and non string values
    columns = columns
        .filter(function (item) {
            return typeof item === 'string' && item.length > 0;
        })
        .filter(function (item) {
            return !Object.prototype.hasOwnProperty.call(EXCLUDE_PROPERTIES, item);
        })
        .filter(function (item, pos, self) {
            return self.indexOf(item) === pos;
        });

    return columns;
};

function getColumnNamesFromInteractivity (interactivity) {
    interactivity = interactivity || [];

    var columnNameFromInteractivity = [];

    if (Array.isArray(interactivity)) {
        columnNameFromInteractivity = columnNameFromInteractivity.concat(interactivity);
    } else {
        columnNameFromInteractivity = columnNameFromInteractivity.concat(interactivity.split(','));
    }

    return columnNameFromInteractivity;
}
