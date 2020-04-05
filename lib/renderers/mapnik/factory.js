'use strict';

const { rendererFactory: mapnikRendererFactory } = require('@carto/cartonik');
const mapnik = require('@carto/mapnik');
const grainstore = require('grainstore');

const layersFilter = require('../../utils/layer-filter');
const MapnikAdaptor = require('./adaptor');
const DefaultQueryRewriter = require('../../utils/default-query-rewriter');

const COLUMN_TYPE_GEOMETRY = 'geometry';
const COLUMN_TYPE_RASTER = 'raster';
const COLUMN_TYPE_DEFAULT = COLUMN_TYPE_GEOMETRY;
const DEFAULT_TILE_SIZE = 256;
const FORMAT_MVT = 'mvt';

function MapnikFactory (options) {
    this.supportedFormats = {
        png: true,
        png32: true,
        'grid.json': true,
        mvt: true
    };

    this._options = options;

    // Set default mapnik options
    this._mapnik_opts = Object.assign({}, {
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

        // INTERNAL: Render time variables
        variables: {}
    }, options.mapnik || {});

    this._options.grainstore = this._options.grainstore ? this._options.grainstore : {};
    this._options.grainstore.mapnik_version = this._options.grainstore.mapnik_version
        ? this._options.grainstore.mapnik_version
        : mapnik.versions.mapnik;

    bootstrapFonts(this._options.grainstore);

    this.tile_scale_factors = this._mapnik_opts.scale_factors.reduce(function (previousValue, currentValue) {
        previousValue[currentValue] = DEFAULT_TILE_SIZE * currentValue;
        return previousValue;
    }, {});
}

function bootstrapFonts (grainstoreOptions) {
    // Set carto renderer configuration for MMLStore
    grainstoreOptions.carto_env = grainstoreOptions.carto_env || {};
    const cenv = grainstoreOptions.carto_env;

    cenv.validation_data = cenv.validation_data || {};
    if (!cenv.validation_data.fonts) {
        mapnik.register_system_fonts();
        mapnik.register_default_fonts();
        cenv.validation_data.fonts = Object.keys(mapnik.fontFiles());
    }
}

module.exports = MapnikFactory;
const NAME = 'mapnik';
module.exports.NAME = NAME;

MapnikFactory.prototype.getName = function () {
    return NAME;
};

MapnikFactory.prototype.supportsFormat = function (format) {
    return !!this.supportedFormats[format];
};

MapnikFactory.prototype.getAdaptor = function (renderer, onTileErrorStrategy) {
    return new MapnikAdaptor(renderer, onTileErrorStrategy);
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
    const isMvt = format === FORMAT_MVT;

    if (mapConfig.isVectorOnlyMapConfig() && !isMvt) {
        const error = new Error(`Unsupported format: 'cartocss' option is missing for ${format}`);
        error.http_status = 400;
        error.type = 'tile';
        return callback(error);
    }

    this.defineExpectedParams(options.params);

    let mmlBuilderConfig;
    try {
        mmlBuilderConfig = this.mapConfigToMMLBuilderConfig(mapConfig, this._mapnik_opts.queryRewriter, options);
    } catch (error) {
        return callback(error);
    }

    const params = Object.assign({}, options.params, mmlBuilderConfig);
    const limits = Object.assign({}, this._mapnik_opts.limits, options.limits);
    const variables = Object.assign({}, this._mapnik_opts.variables, options.variables);

    // fix layer index
    // see https://github.com/CartoDB/Windshaft/blob/0.43.0/lib/backends/map_validator.js#L69-L81
    if (params.layer) {
        params.layer = mapConfig.getLayerIndexByType('mapnik', params.layer);
    }

    const scaleFactor = params.scale_factor === undefined ? 1 : +params.scale_factor;
    const tileSize = this.tile_scale_factors[scaleFactor];

    if (!tileSize) {
        var err = new Error('Tile with specified resolution not found');
        err.http_status = 404;
        return callback(err);
    }

    let mmlBuilder;
    try {
        mmlBuilder = getMMLBuilder(mapConfig, this._options.grainstore, params, format);
    } catch (error) {
        return callback(error);
    }

    mmlBuilder.toXML((err, xml) => {
        if (err) {
            return callback(err);
        }

        try {
            const renderer = mapnikRendererFactory({
                type: isMvt ? 'vector' : 'raster',
                xml: xml,
                strict: !!params.strict,
                bufferSize: this.getBufferSize(mapConfig, format),
                poolSize: this._mapnik_opts.poolSize,
                poolMaxWaitingClients: this._mapnik_opts.poolMaxWaitingClients,
                tileSize: tileSize,
                limits: limits,
                metrics: options.params.metrics,
                variables: variables,
                metatile: this.getMetatile(format), // when raster renderer
                metatileCache: this._mapnik_opts.metatileCache, // when raster renderer
                scale: scaleFactor, // when raster renderer
                gzip: false // when vector renderer
            });

            return callback(null, renderer);
        } catch (err) {
            return callback(err);
        }
    });
};

MapnikFactory.prototype.getMetatile = function (format) {
    var metatile = this._mapnik_opts.metatile;
    if (Number.isFinite(this._mapnik_opts.formatMetatile[format])) {
        metatile = this._mapnik_opts.formatMetatile[format];
    }
    return metatile;
};

MapnikFactory.prototype.getBufferSizeFromOptions = function (format, options) {
    return options && options.formatBufferSize && Number.isFinite(options.formatBufferSize[format])
        ? options.formatBufferSize[format]
        : options.bufferSize;
};

MapnikFactory.prototype.getBufferSize = function (mapConfig, format, options) {
    options = options || this._mapnik_opts;

    if (Number.isFinite(mapConfig.getBufferSize(format))) {
        return mapConfig.getBufferSize(format);
    }

    return this.getBufferSizeFromOptions(format, options);
};

MapnikFactory.prototype.mapConfigToMMLBuilderConfig = function (mapConfig, queryRewriter, rendererOptions) {
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
        'cache-features': rendererOptions.params['cache-features']
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

        var extraOpt = {};
        if (Object.prototype.hasOwnProperty.call(lyropt, 'raster_band')) {
            extraOpt.band = lyropt.raster_band;
        }
        options.datasource_extend.push(mapConfig.getLayerDatasource(layerIndex));
        options.extra_ds_opts.push(extraOpt);

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
            if (Array.isArray(lyropt.interactivity)) {
                lyropt.interactivity = lyropt.interactivity.join(',');
            }

            options.interactivity.push(lyropt.interactivity);
            // grainstore needs to know the layer index to take the interactivity, forced to be 0.
            options.layer = 0;
        }
    }

    return options;
};

function validateLayer (mapConfig, layerIndex) {
    const layer = mapConfig.getLayer(layerIndex);
    var layerOptions = layer.options;

    if (!mapConfig.isVectorOnlyMapConfig()) {
        if (!Object.prototype.hasOwnProperty.call(layerOptions, 'cartocss')) {
            throw new Error('Missing cartocss for layer ' + layerIndex + ' options');
        }

        if (!Object.prototype.hasOwnProperty.call(layerOptions, 'cartocss_version')) {
            throw new Error('Missing cartocss_version for layer ' + layerIndex + ' options');
        }
    }

    if (!Object.prototype.hasOwnProperty.call(layerOptions, 'sql')) {
        throw new Error('Missing sql for layer ' + layerIndex + ' options');
    }

    // It doesn't make sense to have interactivity with raster layers so we raise
    // an error in case someone tries to instantiate a raster layer with interactivity.
    if (isRasterColumnType(layerOptions.geom_type) && layerOptions.interactivity !== undefined) {
        throw new Error('Mapnik raster layers do not support interactivity');
    }
}

// Wrap SQL requests in mapnik format if sent
function prepareQuery (userSql, geomColumnName, geomColumnType, options) {
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

function isRasterColumnType (geomColumnType) {
    return geomColumnType === COLUMN_TYPE_RASTER;
}

function getMMLBuilder (mapConfig, grainstoreOptions, params, format) {
    const mmlBuilderOptions = {};
    if (format === 'png32') {
        mmlBuilderOptions.mapnik_tile_format = 'png';
    }

    if (format === FORMAT_MVT) {
        grainstoreOptions = getMVTOptions(mapConfig, grainstoreOptions);
    }

    const mmlStore = new grainstore.MMLStore(grainstoreOptions);
    return mmlStore.mml_builder(params, mmlBuilderOptions);
}

function getMVTOptions (mapConfig, grainstoreOptions) {
    const mapExtents = mapConfig.getMVTExtents();

    // Make a copy of grainstoreOptions so we can modify it safely
    const newOptions = Object.assign({}, grainstoreOptions);
    newOptions.datasource = Object.assign({}, grainstoreOptions.datasource);

    newOptions.datasource.vector_layer_extent = mapExtents.extent;

    // This function is used to set all the simplify options in Mapnik to work with MVTs
    // so it's tied to `plugins/input/postgis/postgis_datasource.cpp`

    // TWKB encoding: Adapt the rounding to the simplify extent
    newOptions.datasource.twkb_rounding_adjustment = Math.log10(mapExtents.extent / mapExtents.simplify_extent);

    // Binary encoding: Disable snapping and simplify geometries up to half pixel
    newOptions.datasource.simplify_geometries = true;
    newOptions.datasource.simplify_snap_ratio = 0;
    newOptions.datasource.simplify_dp_ratio = 0.5 * mapExtents.extent / mapExtents.simplify_extent;
    newOptions.datasource.simplify_dp_preserve = true;

    return newOptions;
}
