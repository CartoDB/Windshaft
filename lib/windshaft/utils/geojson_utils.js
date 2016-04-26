'use strict';

var cartocssUtils = require('./cartocss_utils');

var EXCLUDE_PROPERTIES = {
    'mapnik::geometry_type': true
};

module.exports.getGeojsonProperties = function (layerOptions) {
    var properties = cartocssUtils.getColumnNamesFromCartoCSS(layerOptions.cartocss);

    properties = properties.concat(getColumnNamesFromInteractivity(layerOptions.interactivity));
    properties = properties.concat(getColumnNamesFromWidgets(layerOptions.widgets));
    properties = properties.concat(getColumnNamesFromFilters(layerOptions.filters));
    properties = properties.concat(getColumnNamesFromDataviews(layerOptions.dataviews));    

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

function getColumnNamesFromDataviews(dataviews) {
    var columnNames = [];

    if (dataviews) {
        for (var dataview in dataviews) {
            if (dataviews.hasOwnProperty(dataview) && dataviews[dataview].options.column) {
                columnNames = columnNames.concat(dataviews[dataview].options.column);
                if (dataviews[dataview].type === 'aggregation'){
                    columnNames = columnNames.concat(dataviews[dataview].options.aggregationColumn);
                }
            }
        }
    }

    return columnNames;
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
