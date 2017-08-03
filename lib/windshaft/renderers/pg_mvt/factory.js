var carto = require('carto');
var debug = require('debug')('windshaft:renderer:pg_mvt');
var _ = require('underscore');
var PSQL = require('cartodb-psql');
var step = require('step');
var format = require('../../utils/format');

var RendererParams = require('../renderer_params');

var sql = require('./sql');
var Renderer = require('./renderer');
var PSQLAdaptor = require('../torque/psql_adaptor');
var BaseAdaptor = require('../base_adaptor');

var SubstitutionTokens = require('../../utils/substitution_tokens');

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
    // jshint newcap:false
    this.options = options || {};
    _.defaults(this.options, {
        // TODO we most likely do not need such adaptor
        sqlClass: PSQLAdaptor(PSQL, options.dbPoolParams)
    });
    if (this.options.sqlClass) {
        this.sqlClass = this.options.sqlClass;
    }
}

module.exports = PgMvtFactory;

// TODO consider removal of this
var formatToRenderer = {
    'mvt': Renderer,
};

PgMvtFactory.prototype = {
    /// API: renderer name, use for information purposes
    name: 'pg_mvt',

    /// API: tile formats this module is able to render
    supported_formats: Object.keys(formatToRenderer),

    getName: function() {
        return this.name;
    },

    supportsFormat: function(format) {
        return !!formatToRenderer[format];
    },

    getAdaptor: function(renderer, format, onTileErrorStrategy) {
        return new BaseAdaptor(renderer, format, onTileErrorStrategy);
    },

    getRenderer: function(mapConfig, format, options, callback) {
        var dbParams = RendererParams.dbParamsFromReqParams(options.params);
        var layer = options.layer;

        if (!formatToRenderer[format]) {
            return callback(new Error("format not supported: " + format));
        }

        var mapnik_layers = mapConfig.getLayers().filter(function(layer) {
            return layer.type === 'cartodb' || layer.type === 'mapnik';
        });

        if (mapnik_layers.length < 1) {
            return callback(new Error("no mapnik layer in mapConfig"));
        }

        if (mapnik_layers.length > 1) {
            return callback(new Error("more than one mapnik layer in mapConfig"));
        }

        var layerObj = mapnik_layers[0];

        _.extend(dbParams, mapConfig.getLayerDatasource(layer));

        var pgSQL = sql(dbParams, this.sqlClass);

        var RendererClass = formatToRenderer[format];

        callback(null, new RendererClass(layerObj, pgSQL, {}, layer));
    }
};
