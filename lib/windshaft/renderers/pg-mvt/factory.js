var _ = require('underscore');
var PSQL = require('cartodb-psql');
var layersFilter = require('../../utils/layer_filter');

var RendererParams = require('../renderer_params');

var Renderer = require('./renderer');
var BaseAdaptor = require('../base_adaptor');

/// API: initializes the renderer, it should be called once
//
/// @param options initialization options.
///     - sqlClass: class used to access postgres, by default is PSQL
///         the class should provide the following interface
///          - constructor(params) where params should contain:
///            host, port, database, user, password.
///            the class is always constructed with dbParams passed to
///            getRender as-is
///          - query(sql, callback(err, data), readonly)
///            gets an SQL query and return a javascript object with
///            the same structure of a JSON format response from
///            CartoDB-SQL-API, for reference see
///            http://github.com/CartoDB/CartoDB-SQL-API/blob/1.8.2/doc/API.md#json
///            The 'readonly' parameter (false by default) requests
///            that running the query should not allowed to change the database.
///     - dbPoolParams: database connection pool params
///          - size: maximum number of resources to create at any given time
///          - idleTimeout: max milliseconds a resource can go unused before it should be destroyed
///          - reapInterval: frequency to check for idle resources
///
function PgMvtFactory(options) {
    this.options = options || {};
}

function isLayerSupported(layer) {
    return layer.type === 'cartodb' || layer.type === 'mapnik';
}

module.exports = PgMvtFactory;
const NAME = 'pg-mvt';
module.exports.NAME = NAME;

var formatToRenderer = {
    'mvt': Renderer,
};

PgMvtFactory.prototype = {
    /// API: renderer name, use for information purposes
    name: NAME,

    /// API: tile formats this module is able to render
    supported_formats: Object.keys(formatToRenderer),

    getName: function () {
        return this.name;
    },

    supportsFormat: function (format) {
        return !!formatToRenderer[format];
    },

    getAdaptor: function (renderer, format, onTileErrorStrategy) {
        return new BaseAdaptor(renderer, format, onTileErrorStrategy);
    },

    getRenderer: function (mapConfig, format, options, callback) {
        var dbParams = RendererParams.dbParamsFromReqParams(options.params);
        var layer = options.layer;

        if (!this.supportsFormat(format)) {
            return callback(new Error("format not supported: " + format));
        }

        var mapLayers = mapConfig.getLayers();
        mapLayers.forEach((layer, layerIndex) => {
            layer.id = mapConfig.getLayerId(layerIndex);
        });


        var mapnik_layers = [];
        var layerFilter = options.layer;
        if (layerFilter && layerFilter !== 'mapnik') {
            var filteredLayers;

            try {
                filteredLayers = layersFilter(mapConfig, mapLayers, layerFilter);
            } catch (err) {
                return callback(err);
            }

            mapnik_layers = filteredLayers.map(function (filteredLayer) {
                return mapConfig.getLayer(+filteredLayer);
            });
        } else {
            mapnik_layers = mapConfig.getLayers().filter(isLayerSupported);
        }

        if (mapnik_layers.length < 1) {
            return callback(new Error("no mapnik layer in mapConfig"));
        }

        _.extend(dbParams, mapConfig.getLayerDatasource(layer));
        const psql = new PSQL(dbParams, this.options.dbPoolParams);
        var RendererClass = formatToRenderer[format];
        callback(null, new RendererClass(mapnik_layers, psql, {}, layer));
    }
};
