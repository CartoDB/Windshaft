var tilelive = require('tilelive');
var grainstore = require('grainstore');
var step = require('step');
var _ = require('underscore');
var assert = require('assert');
var GeojsonRenderer = require('./geojson_renderer');
var CartoPSQL = require('cartodb-psql');
var RendererParams = require('../renderer_params');
var layersFilter = require('../../utils/layer_filter');

var MapnikAdaptor = require('./adaptor');
var BaseAdaptor = require('../base_adaptor');
var DefaultQueryRewriter = require('../../utils/default_query_rewriter');

require('tilelive-mapnik').registerProtocols(tilelive);
require('tilelive-bridge').registerProtocols(tilelive);

var COLUMN_TYPE_GEOMETRY = 'geometry';
var COLUMN_TYPE_RASTER = 'raster';

var COLUMN_TYPE_DEFAULT = COLUMN_TYPE_GEOMETRY;

var DEFAULT_TILE_SIZE = 256;

var FORMAT_MVT = 'mvt';

function MapnikFactory(options) {
    options.grainstore = options.grainstore || {};

    this.supportedFormats = {
        'png': true,
        'png32': true,
        'grid.json': true,
        'geojson': true
    };

    this.supportedFormats[FORMAT_MVT] = true;

    this._mmlStore = new grainstore.MMLStore(options.grainstore);
    this._options = options;

    // Set default mapnik options
    this._mapnik_opts = _.defaults(options.mapnik || {}, {

        geometry_field: 'the_geom_webmercator',

        // Metatile is the number of tiles-per-side that are going
        // to be rendered at once. If all of them will be requested
        // we'd have saved time. If only one will be used, we'd have
        // wasted time.
        //
        // Defaults to 2 as of tilelive-mapnik@0.3.2
        //
        // We'll assume an average of a 4x4 viewport
        metatile: 4,

        // tilelive-mapnik uses an internal cache to store tiles/grids
        // generated when using metatile. This options allow to tune
        // the behaviour for that internal cache.
        metatileCache: {
            // Time an object must stay in the cache until is removed
            ttl: 0,
            // Whether an object must be removed after the first hit
            // Usually you want to use `true` here when ttl>0.
            deleteOnHit: false
        },

        // Override metatile behaviour depending on the format
        formatMetatile: {
            png: 2,
            'grid.json': 1
        },

        // Buffer size is the tickness in pixel of a buffer
        // around the rendered (meta?)tile.
        //
        // This is important for labels and other marker that overlap tile boundaries.
        // Setting to 128 ensures no render artifacts.
        // 64 may have artifacts but is faster.
        // Less important if we can turn metatiling on.
        //
        // defaults to 128 as of tilelive-mapnik@0.3.2
        //
        bufferSize: 64,

        // retina support, which scale factors are supported
        scale_factors: [1, 2],

        limits: {
            // Time in milliseconds a render request can take before it fails, some notes:
            //  - 0 means no render limit
            //  - it considers metatiling, it naive implementation: (render timeout) * (number of tiles in metatile)
            render: 0,
            // As the render request will finish even if timed out, whether it should be placed in the internal
            // cache or it should be fully discarded. When placed in the internal cache another attempt to retrieve
            // the same tile will result in an immediate response, however that will use a lot of more application
            // memory. If we want to enforce this behaviour we have to implement a cache eviction policy for the
            // internal cache.
            cacheOnTimeout: true
        },

        // A query-rewriter can be passed to preprocess SQL queries
        // before passing them to Mapnik.
        // The query rewriter should contain one function:
        // - `query(sql, data)` to transform queries using the optional data provided
        // The data passed to this function can be provided for eaach layer
        // through a `query_rewrite_data` entry in the layer options.
        // By default a dummy query rewriter which doesn't alter queries is used.
        queryRewriter: new DefaultQueryRewriter()
    });

    this.tile_scale_factors = this._mapnik_opts.scale_factors.reduce(function(previousValue, currentValue) {
        previousValue[currentValue] = DEFAULT_TILE_SIZE * currentValue;
        return previousValue;
    }, {});

}

module.exports = MapnikFactory;

MapnikFactory.prototype.getName = function() {
    return 'mapnik';
};

MapnikFactory.prototype.supportsFormat = function(format) {
    return !!this.supportedFormats[format];
};

MapnikFactory.prototype.getAdaptor = function(renderer, format, onTileErrorStrategy) {
    if (format === FORMAT_MVT || format === 'geojson') {
        return new BaseAdaptor(renderer, format, onTileErrorStrategy);
    }
    return new MapnikAdaptor(renderer, format, onTileErrorStrategy);
};

MapnikFactory.prototype.getRenderer = function (mapConfig, format, options, callback) {
    if (format === 'geojson') {
        return this.getGeoJsonRenderer(mapConfig, format, options, callback);
    }
    return this.getMapnikRenderer(mapConfig, format, options, callback);
};

MapnikFactory.prototype.getGeoJsonRenderer = function(mapConfig, format, options, callback) {
    var requestDbParams = RendererParams.dbParamsFromReqParams(options.params);
    var datasource = mapConfig.getLayerDatasource(options.layer);
    var dbParams = _.extend({}, requestDbParams, datasource);
    var dbPoolParams = this._mapnik_opts.geojson.dbPoolParams;
    var cartoPSQL = new CartoPSQL(dbParams, dbPoolParams);

    var layerFilter = options.layer;
    var mapLayers = mapConfig.getLayers();
    var layers = [];

    if (typeof layerFilter === 'number') {
        layers = [ mapConfig.getLayer(layerFilter) ];
    } else if (layerFilter && layerFilter !== 'mapnik') {
        var filteredLayers;

        try {
            filteredLayers = layersFilter(mapConfig, mapLayers, layerFilter);
        } catch (err) {
            return callback(err);
        }

        layers = filteredLayers.map(function (filteredLayer) {
            return mapConfig.getLayer(+filteredLayer);
        });
    } else {
        layers = mapConfig.getLayers();
    }

    callback(null, new GeojsonRenderer(cartoPSQL, layers, this._mapnik_opts.geojson));
};

MapnikFactory.prototype.getMapnikRenderer = function(mapConfig, format, options, callback) {
    var self = this;
    var limits = _.defaults({}, options.limits, this._mapnik_opts.limits);
    var mmlBuilderConfig = this.mapConfigToMMLBuilderConfig(mapConfig, this._mapnik_opts.queryRewriter, options.layer);
    var params = _.defaults(mmlBuilderConfig, options.params);

    // fix layer index
    // see https://github.com/CartoDB/Windshaft/blob/0.43.0/lib/windshaft/backends/map_validator.js#L69-L81
    if (!!params.layer) {
        params.layer = mapConfig.getLayerIndexByType('mapnik', params.layer);
    }

    var scaleFactor = _.isUndefined(params.scale_factor) ? 1 : +params.scale_factor,
        tileSize = this.tile_scale_factors[scaleFactor];

    if (!tileSize) {
        var err = new Error('Tile with specified resolution not found');
        err.http_status = 404;
        return callback(err);
    }

    step(
        function initBuilder() {
            var mmlBuilderOptions = {};
            if (format === 'png32') {
                mmlBuilderOptions.mapnik_tile_format = 'png';
            }

            self._mmlStore.mml_builder(params, mmlBuilderOptions).toXML(this);
        },
        function loadMapnik(err, xml) {
            assert.ifError(err);

            var metatile = self._mapnik_opts.metatile;
            if (Number.isFinite(self._mapnik_opts.formatMetatile[format])) {
                metatile = self._mapnik_opts.formatMetatile[format];
            }

            var query = {
                metatile: metatile,
                metatileCache: self._mapnik_opts.metatileCache,
                bufferSize: self._mapnik_opts.bufferSize,
                poolSize: self._mapnik_opts.poolSize,
                scale: scaleFactor,
                tileSize: tileSize,
                autoLoadFonts: false,
                internal_cache: false,
                limits: limits
            };

            var isMvt = format === FORMAT_MVT;

            // build full document to pass to tilelive
            var uri = {
                query: query,
                protocol: isMvt ? 'bridge:' : 'mapnik:',
                xml: xml,
                strict: !!params.strict
            };

            if (isMvt) {
                uri.gzip = false;
            }

            // hand off to tilelive to create a renderer
            tilelive.load(uri, this);
        },
        function returnCallback(err, source) {
            callback(err, source);
        }
    );
};

// TODO: fix this
MapnikFactory.prototype.mapConfigToMMLBuilderConfig = function(mapConfig, queryRewriter, layerFilter) {
    // jshint maxcomplexity: 8
    var self = this;
    var filteredLayerIndexes;
    var options = {
        ids: [],
        sql: [],
        originalSql: [],
        style: [],
        style_version: [],
        interactivity: [],
        ttl: 0,
        datasource_extend: [],
        extra_ds_opts: [],
        gcols: []
    };

    try {
        filteredLayerIndexes = layersFilter(mapConfig, mapConfig.getLayers(), layerFilter);
    } catch (err) {
        // aliases mapnik, all,
        filteredLayerIndexes = [];
        for (var i = 0; i < mapConfig.getLayers().length; i++) {
            filteredLayerIndexes.push(i);
        }
    }

    filteredLayerIndexes.filter(function (layerIndex) {
        return mapConfig.layerType(layerIndex) === 'mapnik';
    })
    .reduce(function (options, layerIndex) {
        var layer = mapConfig.getLayer(layerIndex);

        validateLayer(layer, layerIndex);

        options.ids.push(mapConfig.getLayerId(layerIndex));
        var lyropt = layer.options;

        options.style.push(lyropt.cartocss);
        options.style_version.push(lyropt.cartocss_version);

        var query = queryRewriter.query(lyropt.sql, lyropt.query_rewrite_data);
        var queryOptions = prepareQuery(query, lyropt.geom_column, lyropt.geom_type, self._mapnik_opts);

        options.sql.push(queryOptions.sql);
        options.originalSql.push(query);

        options.gcols.push({
            type: queryOptions.geomColumnType, // grainstore allows undefined here
            name: queryOptions.geomColumnName
        });

        var extra_opt = {};
        if ( lyropt.hasOwnProperty('raster_band') ) {
            extra_opt.band = lyropt.raster_band;
        }

        var datasource_extend = mapConfig.getLayerDatasource(layerIndex) || {};
        if ( lyropt.hasOwnProperty('srid') ) {
            datasource_extend.srid = lyropt.srid;
        }

        options.datasource_extend.push( datasource_extend );
        options.extra_ds_opts.push( extra_opt );

        return options;
    }, options);

    if (!options.sql.length) {
        throw new Error("No 'mapnik' layers in MapConfig");
    }

    if (!options.gcols.length) {
        options.gcols = undefined;
    }

    // Grainstore limits interactivity to one layer. If there are more than one layer in layer filter then interactivity
    // won't be passed to grainstore (due to format requested is png, only one layer is allowed for grid.json format)
    if (filteredLayerIndexes.length === 1) {
        var lyrInteractivity = mapConfig.getLayer(filteredLayerIndexes[0]);
        var lyropt = lyrInteractivity.options;

        if (lyropt.interactivity) {
            // NOTE: interactivity used to be a string as of version 1.0.0
            if (_.isArray(lyropt.interactivity)) {
                lyropt.interactivity = lyropt.interactivity.join(',');
            }

            options.interactivity.push(lyropt.interactivity);
            // grainstore needs to know the layer index to take the interactivity, forced to be 0.
            options.layer = 0;
        }
    }

    return options;
};

function validateLayer(layer, layerIdx) {
    var layerOptions = layer.options;

    if ( ! layerOptions.hasOwnProperty('cartocss') ) {
        throw new Error("Missing cartocss for layer " + layerIdx + " options");
    }
    if ( ! layerOptions.hasOwnProperty('cartocss_version') ) {
        throw new Error("Missing cartocss_version for layer " + layerIdx + " options");
    }
    if ( ! layerOptions.hasOwnProperty('sql') ) {
        throw new Error("Missing sql for layer " + layerIdx + " options");
    }

    // It doesn't make sense to have interactivity with raster layers so we raise
    // an error in case someone tries to instantiate a raster layer with interactivity.
    if (isRasterColumnType(layerOptions.geom_type) && !_.isUndefined(layerOptions.interactivity)) {
        throw new Error("Mapnik raster layers do not support interactivity");
    }
}

// Wrap SQL requests in mapnik format if sent
function prepareQuery(userSql, geomColumnName, geomColumnType, options) {

    // remove trailing ';'
    userSql = userSql.replace(/;\s*$/, '');

    geomColumnName = geomColumnName || options.geometry_field;
    geomColumnType = geomColumnType || COLUMN_TYPE_DEFAULT;


    return {
        sql: '(' + userSql + ') as cdbq',
        geomColumnName: geomColumnName,
        geomColumnType: geomColumnType
    };
}

function isRasterColumnType(geomColumnType) {
    return geomColumnType === COLUMN_TYPE_RASTER;
}
