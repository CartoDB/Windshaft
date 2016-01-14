var Crypto = require('crypto');
var semver = require('semver');
var _ = require('underscore');

var Datasource = require('./datasource');

var WidgetFactory = require('./widgets/factory');
var widgetFactory = new WidgetFactory();

var FilterFactory = require('./filters/factory');
var FiltersQueryBuilder = require('./filters/query_builder');
var filterFactory = new FilterFactory();

var debug = require('debug')('windshaft:mapconfig');

// Map configuration object

/// API: Create MapConfig from configuration object
//
/// @param obj js MapConfiguration object, see
///        http://github.com/CartoDB/Windshaft/wiki/MapConfig-specification
///
function MapConfig(config, datasource) {
    // TODO: inject defaults ?
    this._cfg = config;

    if ( ! semver.satisfies(this.version(), '>= 1.0.0 <= 1.5.0') ) {
        throw new Error("Unsupported layergroup configuration version " + this.version());
    }

    if ( ! this._cfg.hasOwnProperty('layers') ) {
        throw new Error("Missing layers array from layergroup config");
    }

    this._cfg.layers.forEach(function(layer, i) {
    if ( ! layer.hasOwnProperty('options') ) {
        throw new Error("Missing options from layer " + i + " of layergroup config");
    }
    // NOTE: interactivity used to be a string as of version 1.0.0
    if ( Array.isArray(layer.options.interactivity) ) {
        layer.options.interactivity = layer.options.interactivity.join(',');
    }
  });

    /**
    * @type {Datasource}
    */
    this._datasource = datasource;

    this._widgets = this._cfg.layers.map(function(layer) {
        var layerWidgets = layer.options.widgets || {};

        return Object.keys(layerWidgets).reduce(function(widgets, widgetName) {
            widgets[widgetName] = widgetFactory.getWidget(layer.options.sql, layerWidgets[widgetName]);

            return widgets;
        }, {});
    });

    this._filters = this._cfg.layers.map(function(layer) {
        var filters = {};
        var layerWidgets = layer.options.widgets;
        if (layerWidgets) {
            Object.keys(layerWidgets).reduce(function(filters, widgetName) {
                filters[widgetName] = widgetFactory.getFilterDefinition(layerWidgets[widgetName]);
                return filters;
            }, filters);
        }
        return filters;
    });

    this._id = null;
}

function md5Hash(s) {
    return Crypto.createHash('md5').update(s).digest('hex');
}

/// API: Get serialized version of this MapConfig
MapConfig.prototype.serialize = function() {
    if (this._datasource.isEmpty()) {
        return JSON.stringify(this._cfg);
    }
    return JSON.stringify({
        cfg: this._cfg,
        ds: this._datasource.obj()
    });
};

/// API: Get identifier for this MapConfig
MapConfig.prototype.id = function() {
    if (this._id === null) {
        this._id = md5Hash(JSON.stringify(this._cfg));
    }
    //debug('MapConfig.id=%s', this._id);
    return this._id;
};

/// API: Get configuration object of this MapConfig
MapConfig.prototype.obj = function() {
    return this._cfg;
};

MapConfig.prototype.version = function() {
    return this._cfg.version || '1.0.0';
};

MapConfig.prototype.setDbParams = function(dbParams) {
    this._cfg.dbparams = dbParams;
    this.flush();
};

MapConfig.prototype.flush = function() {
    // flush id so it gets recalculated
    this._id = null;
};

/// API: Get type string of given layer
//
/// @param num layer index (0-based)
/// @returns a type string, as read from the layer
///
MapConfig.prototype.layerType = function(num) {
    var lyr = this.getLayer(num);
    if ( ! lyr ) {
        return undefined;
    }
    return this.getType(lyr.type);
};

MapConfig.prototype.getType = function(type) {
    // TODO: check validity of other types ?
    return (!type || type === 'cartodb') ? 'mapnik' : type;
};

/*****************************************************************************
 * Layers
 ****************************************************************************/

/// API: Get layer by index
//
/// @returns undefined on invalid index
///
MapConfig.prototype.getLayer = function(layerIndex) {
    var layer = this._cfg.layers[layerIndex];
    var filters = this.getLayerFilters(layerIndex);

    if (layer && filters.length > 0) {
        // deep copy to not rewrite original layer in mapconfig
        layer = JSON.parse(JSON.stringify(layer));
        layer.options.sql = FiltersQueryBuilder.getSql(layer.options.sql, filters);
        debug(layer.options.sql);
    }

    return layer;
};

MapConfig.prototype.getLayers = function() {
    return this._cfg.layers.map(function(_layer, layerIndex) {
        return this.getLayer(layerIndex);
    }.bind(this));
};


/*****************************************************************************
 * Widgets
 ****************************************************************************/

MapConfig.prototype.getWidgets = function(layerIndex) {
    var layerWidgets = this._widgets[layerIndex];
    return Object.keys(layerWidgets).reduce(function(acc, widgetName) {
        acc[widgetName] = {
            type: layerWidgets[widgetName].type
        };
        return acc;
    }, {});
};

MapConfig.prototype.getWidget = function(layerIndex, widgetName) {
    var layerWidgets = this._widgets[layerIndex];
    if (!layerWidgets) {
        throw new Error('Layer ' + layerIndex + ' not found');
    }

    var widget = layerWidgets[widgetName];

    if (!widget) {
        throw new Error("Widget '" + widgetName + "' not found at layer " + layerIndex);
    }
    debug('--> WIDGET %s', widget);

    return widget;
};

/*****************************************************************************
 * Filters
 ****************************************************************************/

MapConfig.prototype.setFiltersParams = function(filters) {
    debug('filters=%j', filters);
    var self = this;
    // TODO Do proper validation
    if (Array.isArray(filters.layers)) {
        filters.layers.forEach(function(layerFilters, layerIndex) {
            Object.keys(layerFilters).forEach(function(filterName) {
                var filterDefinition = self.getFilterDefinition(layerIndex, filterName);
                if (filterDefinition) {
                    filterFactory.getFilter(filterDefinition, layerFilters[filterName]);
                }
            });
        });
    }
    this._cfg.filters = filters;
    this.flush();
};

MapConfig.prototype.getFiltersParams = function(layerIndex, exclude) {
    var filters = this._cfg.filters || {};
    var layerFilters = {};

    if (Array.isArray(filters.layers)) {
        layerFilters = filters.layers[layerIndex] || {};
    }

    return _.omit(layerFilters, exclude);
};

MapConfig.prototype.getFilterDefinition = function(layerIndex, filterName) {
//    debug(this._filters);
    return this._filters[layerIndex][filterName];
};

MapConfig.prototype.clearFilters = function() {
    delete this._cfg.filters;
    this.flush();
};

MapConfig.prototype.getLayerFilters = function(layerIndex, exclude) {
    var self = this;

    var filters = [];

    var layer = this._cfg.layers[layerIndex];
    var filtersParams = this.getFiltersParams(layerIndex, exclude);


    if (layer && filtersParams) {
        filters = Object.keys(filtersParams).map(function(filterName) {
            return filterFactory.getFilter(
                self.getFilterDefinition(layerIndex, filterName),
                filtersParams[filterName]
            );
        });
    }

    return filters;
};

/*****************************************************************************
 * Datasource
 ****************************************************************************/

MapConfig.prototype.getLayerDatasource = function(layerId) {
    return this._datasource.getLayerDatasource(layerId);
};

/**
 * À la Factory method
 *
 * @param {Object} rawConfig
 * @param {Datasource} [datasource=Datasource.EmptyDatasource()]
 * @returns {MapConfig}
 */
function create(rawConfig, datasource) {
    if (rawConfig.ds) {
        return new MapConfig(rawConfig.cfg, new Datasource(rawConfig.ds));
    }
    datasource = datasource || Datasource.EmptyDatasource();
    return new MapConfig(rawConfig, datasource);
}

module.exports = MapConfig;
// Factory like method to create MapConfig objects when you are unsure about being
// able to provide all the MapConfig collaborators or you have to create a MapConfig
// object from a serialized version
module.exports.create = create;
