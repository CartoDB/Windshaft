'use strict';

var cartocssUtils = require('./cartocss_utils');

var EXCLUDE_PROPERTIES = {
    'mapnik::geometry_type': true,
    'mapnik-geometry-type': true
};

module.exports.getGeojsonProperties = function (layerOptions) {
    var properties = [];

    if (Array.isArray(layerOptions.columns)) {
        properties = layerOptions.columns;
    }

    properties = properties.concat(cartocssUtils.getColumnNamesFromCartoCSS(layerOptions.cartocss));
    properties = properties.concat(getColumnNamesFromInteractivity(layerOptions.interactivity));

    // filter out repeated ones and non string values
    properties = properties
        .filter(function (item) {
            return typeof item === 'string' && item.length > 0;
        })
        .filter(function(item) {
            return !EXCLUDE_PROPERTIES.hasOwnProperty(item);
        })
        .filter(function (item, pos, self) {
            return self.indexOf(item) === pos;
        });

    return properties;
};

function getColumnNamesFromInteractivity(interactivity) {
    interactivity = interactivity || [];

    var columnNameFromInteractivity = [];

    if (Array.isArray(interactivity)) {
        columnNameFromInteractivity = columnNameFromInteractivity.concat(interactivity);
    } else {
        columnNameFromInteractivity = columnNameFromInteractivity.concat(interactivity.split(','));
    }

    return columnNameFromInteractivity;
}
