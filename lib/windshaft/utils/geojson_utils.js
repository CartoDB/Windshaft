'use strict';

var cartocssUtils = require('./cartocss_utils');

var EXCLUDE_PROPERTIES = {
    'mapnik::geometry_type': true,
    'mapnik-geometry-type': true
};

module.exports.getGeojsonProperties = function (layerOptions) {
    var properties = cartocssUtils.getColumnNamesFromCartoCSS(layerOptions.cartocss);

    properties = properties.concat(getColumnNamesFromInteractivity(layerOptions.interactivity));

    ['widgets', 'filters', 'dataviews'].map(function (kind) {
        properties = properties.concat(getColumnNamesFrom(kind, layerOptions));
    });

    // filter out repeated ones
    properties = properties
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

function hasColumnDefined(kind, config, prop) {
    return config[kind][prop].options && config[kind][prop].options.column;
}

function hasAggreagtionColumnDefined(kind, config, prop) {
    return hasColumnDefined(kind, config, prop) &&
        config[kind][prop].type === 'aggregation' &&
        config[kind][prop].options.aggregationColumn;
}

function getColumnNamesFrom(kind, config) {
    var columnNames = [];

    if (config[kind]) {
        for (var prop in config[kind]) {
            if (config[kind].hasOwnProperty(prop)){
                if (hasColumnDefined(kind, config, prop)) {
                    columnNames = columnNames.concat(config[kind][prop].options.column);
                }
                if (hasAggreagtionColumnDefined(kind, config, prop)){
                    columnNames = columnNames.concat(config[kind][prop].options.aggregationColumn);
                }
            }
        }
    }

    return columnNames;
}
