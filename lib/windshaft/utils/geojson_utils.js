'use strict';

var cartocssUtils = require('./cartocss_utils');

module.exports.getGeojsonProperties = function (layerOptions) {
    var properties = cartocssUtils.getColumnNamesFromCartoCSS(layerOptions.cartocss);

    properties = properties.concat(getColumnNamesFromInteractivity(layerOptions.interactivity));
    properties = properties.concat(getColumnNamesFromWidgets(layerOptions.widgets));
    properties = properties.concat(getColumnNamesFromFilters(layerOptions.filters));

    // filter out repeated ones
    properties = properties.filter(function (item, pos, self) {
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

function getColumnNamesFromWidgets(widgets) {
    var columnNamesFromWidgets = [];

    if (widgets) {
        for (var widget in widgets) {
            if (widgets.hasOwnProperty(widget) && widgets[widget].options.column) {
                columnNamesFromWidgets = columnNamesFromWidgets.concat(widgets[widget].options.column);
                if (widgets[widget].type === 'aggregation'){
                    columnNamesFromWidgets = columnNamesFromWidgets.concat(widgets[widget].options.aggregationColumn);
                }
            }
        }
    }

    return columnNamesFromWidgets;
}

function getColumnNamesFromFilters(filters) {
    var columnNamesFromFilters = [];

    if (filters) {
        for (var filter in filters) {
            if (filters.hasOwnProperty(filter) && filters[filter].options.column) {
                columnNamesFromFilters = columnNamesFromFilters.concat(filters[filter].options.column);
            }
        }
    }

    return columnNamesFromFilters;
}
