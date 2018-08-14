var tilelive = require('tilelive');
var grainstore = require('grainstore');
var step = require('step');
var _ = require('underscore');
var assert = require('assert');
var layersFilter = require('../../utils/layer_filter');

var MapnikAdaptor = require('./adaptor');
var BaseAdaptor = require('../base_adaptor');
var DefaultQueryRewriter = require('../../utils/default_query_rewriter');

require('tilelive-mapnik').registerProtocols(tilelive);
require('@carto/tilelive-bridge').registerProtocols(tilelive);

var COLUMN_TYPE_GEOMETRY = 'geometry';
var COLUMN_TYPE_RASTER = 'raster';

var COLUMN_TYPE_DEFAULT = COLUMN_TYPE_GEOMETRY;

var DEFAULT_TILE_SIZE = 256;

const DEFAULT_EXTENT = 4096;
const DEFAULT_SIMPLIFY_EXTENT = 256;

var FORMAT_MVT = 'mvt';

function MapnikFactory(options) {

    this.supportedFormats = {
        'png': true,
        'png32': true,
        'grid.json': true,
        'mvt': true
    };

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
        formatMetatile: {},

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

        // Buffer size behaviour depending on the format
        formatBufferSize: {},

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
        queryRewriter: new DefaultQueryRewriter(),

        // If enabled Mapnik will reuse the features retrieved from the database
        // instead of requesting them once per style inside a layer
        'cache-features': true,

        // Require stats per query to the renderer
        metrics: false,

        // Options for markers attributes, ellipses and images caches
        markers_symbolizer_caches: {
            disabled: false
        },

        //INTERNAL: Render time variables
        variables: {}
    });

    this.tile_scale_factors = this._mapnik_opts.scale_factors.reduce(function(previousValue, currentValue) {
        previousValue[currentValue] = DEFAULT_TILE_SIZE * currentValue;
        return previousValue;
    }, {});

}

module.exports = MapnikFactory;
const NAME = 'mapnik';
module.exports.NAME = NAME;

MapnikFactory.prototype.getName = function() {
    return NAME;
};

MapnikFactory.prototype.supportsFormat = function(format) {
    return !!this.supportedFormats[format];
};

MapnikFactory.prototype.getAdaptor = function(renderer, format, onTileErrorStrategy) {
    if (format === FORMAT_MVT) {
        return new BaseAdaptor(renderer, format, onTileErrorStrategy);
    }
    return new MapnikAdaptor(renderer, format, onTileErrorStrategy);
};

MapnikFactory.prototype.defineExpectedParams = function (params) {
    if (params['cache-features'] === undefined) {
        params['cache-features'] = this._mapnik_opts['cache-features'];
    }

    if (params.metrics === undefined) {
        params.metrics = this._mapnik_opts.metrics;
    }

    if (params.markers_symbolizer_caches === undefined) {
        params.markers_symbolizer_caches = this._mapnik_opts.markers_symbolizer_caches;
    }
};

MapnikFactory.prototype.getRenderer = function (mapConfig, format, options, callback) {
    var self = this;

    if (mapConfig.isVectorOnlyMapConfig() && format !== FORMAT_MVT) {
        const error = new Error(`Unsupported format: 'cartocss' option is missing for ${format}`);
        error.http_status = 400;
        error.type = 'tile';
        return callback(error);
    }

    this.defineExpectedParams(options.params);
    var mmlBuilderConfig = this.mapConfigToMMLBuilderConfig(mapConfig, this._mapnik_opts.queryRewriter, options);
    var params = _.defaults(mmlBuilderConfig, options.params);
    var limits = _.defaults({}, options.limits, this._mapnik_opts.limits);
    var variables = _.defaults({}, options.variables, this._mapnik_opts.variables);

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
            var grainstoreOptions = self._options.grainstore;
            if (format === 'png32') {
                mmlBuilderOptions.mapnik_tile_format = 'png';
            } else if (format === FORMAT_MVT) {
                grainstoreOptions = Object.assign({}, grainstoreOptions);
                setLayerExtent(grainstoreOptions, mmlBuilderConfig);
                setSimplifyExtent(grainstoreOptions, mmlBuilderConfig);
            }

            self._mmlStore = new grainstore.MMLStore(grainstoreOptions);
            self._mmlStore.mml_builder(params, mmlBuilderOptions).toXML(this);
        },
        function loadMapnik(err, xml) {
            assert.ifError(err);

            var query = {
                metatile: self.getMetatile(format),
                metatileCache: self._mapnik_opts.metatileCache,
                bufferSize: self.getBufferSize(mapConfig, format),
                poolSize: self._mapnik_opts.poolSize,
                scale: scaleFactor,
                tileSize: tileSize,
                autoLoadFonts: false,
                internal_cache: false,
                limits: limits,
                metrics: options.params.metrics,
                variables: variables
            };

            var isMvt = format === FORMAT_MVT;

            // build full document to pass to tilelive
            var uri = {
                pathname: '', // to avoid TypeError: https://nodejs.org/api/path.html#path_path_dirname_path
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

MapnikFactory.prototype.getMetatile = function(format) {
    var metatile = this._mapnik_opts.metatile;
    if (Number.isFinite(this._mapnik_opts.formatMetatile[format])) {
        metatile = this._mapnik_opts.formatMetatile[format];
    }
    return metatile;
};

MapnikFactory.prototype.getBufferSizeFromOptions = function(format, options) {
    return options && options.formatBufferSize && Number.isFinite(options.formatBufferSize[format]) ?
        options.formatBufferSize[format] :
        options.bufferSize;
};

MapnikFactory.prototype.getBufferSize = function(mapConfig, format, options) {
    options = options || this._mapnik_opts;

    if (Number.isFinite(mapConfig.getBufferSize(format))) {
        return mapConfig.getBufferSize(format);
    }

    return this.getBufferSizeFromOptions(format, options);
};


MapnikFactory.prototype.mapConfigToMMLBuilderConfig = function(mapConfig, queryRewriter, rendererOptions) {
    var self = this;
    var options = {
        ids: [],
        sql: [],
        originalSql: [],
        style: [],
        style_version: [],
        zooms: [],
        interactivity: [],
        ttl: 0,
        datasource_extend: [],
        extra_ds_opts: [],
        gcols: [],
        'cache-features': rendererOptions.params['cache-features'],
        layer_extents: [],
        simplify_extents: []
    };

    var layerFilter = rendererOptions.layer;

    var filteredLayerIndexes = layersFilter(mapConfig, layerFilter);
    filteredLayerIndexes.reduce(function (options, layerIndex) {
        var layer = mapConfig.getLayer(layerIndex);

        validateLayer(mapConfig, layerIndex);

        options.ids.push(mapConfig.getLayerId(layerIndex));
        var lyropt = layer.options;

        if (lyropt.cartocss !== undefined && lyropt.cartocss_version !== undefined) {
            options.style.push(lyropt.cartocss);
            options.style_version.push(lyropt.cartocss_version);
        }

        var query = queryRewriter.query(lyropt.sql, lyropt.query_rewrite_data);
        var queryOptions = prepareQuery(query, lyropt.geom_column, lyropt.geom_type, self._mapnik_opts);

        options.sql.push(queryOptions.sql);
        options.originalSql.push(query);

        var zoom = {};
        if (Number.isFinite(lyropt.minzoom)) {
            zoom.minzoom = lyropt.minzoom;
        }
        if (Number.isFinite(lyropt.maxzoom)) {
            zoom.maxzoom = lyropt.maxzoom;
        }
        options.zooms.push(zoom);

        options.gcols.push({
            type: queryOptions.geomColumnType, // grainstore allows undefined here
            name: queryOptions.geomColumnName
        });

        var extra_opt = {};
        if ( lyropt.hasOwnProperty('raster_band') ) {
            extra_opt.band = lyropt.raster_band;
        }
        options.datasource_extend.push(mapConfig.getLayerDatasource(layerIndex));
        options.extra_ds_opts.push( extra_opt );

        options.layer_extents.push(lyropt.vector_extent);
        options.simplify_extents.push(lyropt.vector_simplify_extent);

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

function validateLayer(mapConfig, layerIndex) {
    const layer = mapConfig.getLayer(layerIndex);
    var layerOptions = layer.options;

    if (!mapConfig.isVectorOnlyMapConfig()) {
        if ( ! layerOptions.hasOwnProperty('cartocss') ) {
            throw new Error("Missing cartocss for layer " + layerIndex + " options");
        }

        if ( ! layerOptions.hasOwnProperty('cartocss_version') ) {
            throw new Error("Missing cartocss_version for layer " + layerIndex + " options");
        }
    }

    if ( ! layerOptions.hasOwnProperty('sql') ) {
        throw new Error("Missing sql for layer " + layerIndex + " options");
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

function checkRange(number, min, max) {
    return (!isNaN(number) && number >= min && number <= max);
}

function setLayerExtent(grainstoreOptions, mmlOptions) {
    const extents = _.uniq(mmlOptions.layer_extents);
    const def = extents.indexOf(undefined);
    if (def !== -1) {
        if (extents.length === 1) {
            return;
        }
        extents[def] = DEFAULT_EXTENT;
    }

    const extentsDefined = _.uniq(extents);

    if (extentsDefined.length > 1) {
        throw new Error("Multiple extent values in mapConfig (" + extents + ")");
    }

    // Accepted values between 1 and 2^31 -1 (2147483647)
    const extent = parseInt(extentsDefined[0], 10);
    if (!checkRange(extent, 1, 2147483647)) {
        throw new Error("Invalid vector_extent. Must be between 1 and 2147483647");
    }

    grainstoreOptions.datasource = Object.assign({vector_layer_extent : extents[0] }, grainstoreOptions.datasource);
}

function setSimplifyExtent(grainstoreOptions, mmlOptions) {
    const extents = _.uniq(mmlOptions.simplify_extents);

    const def = extents.indexOf(undefined);
    if (def !== -1) {
        extents[def] = DEFAULT_SIMPLIFY_EXTENT;
    }
    const extentsDefined = _.uniq(extents);

    if (extentsDefined.length > 1) {
        throw new Error("Multiple simplify extent values in mapConfig (" + extents + ")");
    }

    // Accepted values between 1 and vector_extent
    const vector_extent = grainstoreOptions.datasource.vector_layer_extent || DEFAULT_EXTENT;
    const simplify = parseInt(extentsDefined[0], 10);
    if (!checkRange(simplify, 1, vector_extent)) {
        throw new Error("Invalid vector_simplify_extent (" + simplify + "). " +
                        "Must be between 1 and vector_extent [" + vector_extent + "]");
    }

    // This function is used to set all the simplify options in Mapnik to work with MVTs
    // so it's tied to `plugins/input/postgis/postgis_datasource.cpp`

    // TWKB encoding: Adapt the rounding to the simplify extent
    grainstoreOptions.datasource.twkb_rounding_adjustment = Math.log10(vector_extent / simplify);

    // Binary encoding: Disable snapping and simplify geometries up to half pixel
    grainstoreOptions.datasource.simplify_geometries = true;
    grainstoreOptions.datasource.simplify_snap_ratio = 0;
    grainstoreOptions.datasource.simplify_dp_ratio = 0.5 * vector_extent / simplify;
    grainstoreOptions.datasource.simplify_dp_preserve = true;
}