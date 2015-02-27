var tilelive = require('tilelive');
var step = require('step');
var _ = require('underscore');

var RendererParams = require('../renderer_params');

require('tilelive-mapnik').registerProtocols(tilelive);

var COLUMN_TYPE_GEOMETRY = 'geometry';
var COLUMN_TYPE_RASTER = 'raster';

var COLUMN_NAME_DEFAULT = global.environment.postgres.geometry_field || 'the_geom_webmercator';
var COLUMN_TYPE_DEFAULT = COLUMN_TYPE_GEOMETRY;

var MAPNIK_COLUMN_NAME = '__cdb_the_geom';

var DEFAULT_TILE_SIZE = 256;

function MapnikFactory(mmlStore, options) {
    this._mmlStore = mmlStore;
    this._options = options;

    var tile_scale_factors = options.scale_factors || [1, 2];

    this.tile_scale_factors = tile_scale_factors.reduce(function(previousValue, currentValue) {
        previousValue[currentValue] = DEFAULT_TILE_SIZE * currentValue;
        return previousValue;
    }, {});

    // Set default mapnik options
    this._mapnik_opts = _.defaults(options.mapnik_opts || {}, {

        // Metatile is the number of tiles-per-side that are going
        // to be rendered at once. If all of them will be requested
        // we'd have saved time. If only one will be used, we'd have
        // wasted time.
        //
        // Defaults to 2 as of tilelive-mapnik@0.3.2
        //
        // We'll assume an average of a 4x4 viewport
        metatile: 4,

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
        bufferSize: 64
    });
}

module.exports = MapnikFactory;


MapnikFactory.prototype.getRenderer = function(mapConfig, params, format, layer, callback) {
    var self = this;
    var mml_builder;

    if ( params.token ) {
        delete params.interactivity; // will be rewritten from MapConfig
        params = _.defaults(params, this.mapConfigToMMLBuilderConfig(mapConfig));
        delete params.token;
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
            // create an mapnik mml builder object
            mml_builder = self._mmlStore.mml_builder(params, this);
        },
        function generateXML(err){
            if (err) {
                throw err;
            }
            mml_builder.toXML(this);
        },
        function loadMapnik(err, data){
            // TODO either remove this profiler call or implement it
//            if (!err && req.profiler) {
//                req.profiler.done('generateXML');
//            }

            if (err) {
                throw err;
            }

            var query = {
                // TODO: document what `base` is
                base: RendererParams.createKey(params) + '/xia',
                metatile: self._mapnik_opts.metatile,
                bufferSize: self._mapnik_opts.bufferSize,
                scale: scaleFactor,
                tileSize: tileSize,
                autoLoadFonts: 'false',
                internal_cache: false
            };

            // build full document to pass to tilelive
            var uri = {
                query: query,
                protocol: 'mapnik:',
                slashes: true,
                xml: data,
                strict: !!params.strict, // force boolean
                mml: {
                    format: params.format // this seems to be useless
                }
            };

            // hand off to tilelive to create a renderer
            tilelive.load(uri, this);
        },
        function returnCallback(err, source) {
            callback(err, source);
        }
    );
};

// jshint maxcomplexity:12
MapnikFactory.prototype.mapConfigToMMLBuilderConfig = function(mapConfig) {
    var cfg = mapConfig.obj();
    var sql = [];
    var style = [];
    var geom_columns = [];
    var datasource_extend = [];
    var extra_ds_opts = [];
    var interactivity = [];
    var style_version = [];
    for ( var i=0; i<cfg.layers.length; ++i ) {

        var lyr = cfg.layers[i];

        if ( mapConfig.layerType(i) !== 'mapnik' ) {
            continue;
        }

        if ( ! lyr.hasOwnProperty('options') ) {
            throw new Error("Missing options from layer " + i + " of layergroup config");
        }
        var lyropt = lyr.options;

        if ( ! lyropt.hasOwnProperty('cartocss') ) {
            throw new Error("Missing cartocss for layer " + i + " options");
        }
        style.push(lyropt.cartocss);
        if ( ! lyropt.hasOwnProperty('cartocss_version') ) {
            throw new Error("Missing cartocss_version for layer " + i + " options");
        }
        style_version.push(lyropt.cartocss_version);

        if ( ! lyropt.hasOwnProperty('sql') ) {
            throw new Error("Missing sql for layer " + i + " options");
        }

        var queryOptions = prepareQuery(lyropt.sql, lyropt.geom_column, lyropt.geom_type);

        sql.push(queryOptions.sql);

        geom_columns.push({
            type: queryOptions.geomColumnType, // grainstore allows undefined here
            name: queryOptions.geomColumnName
        });

        // It doesn't make sense to have interactivity with raster layers so we raise
        // an error in case someone tries to instantiate a raster layer with interactivity.
        if (queryOptions.geomColumnType === COLUMN_TYPE_RASTER && !_.isUndefined(lyropt.interactivity)) {
            throw new Error("Mapnik raster layers do not support interactivity");
        }
        // NOTE: interactivity used to be a string as of version 1.0.0
        if ( _.isArray(lyropt.interactivity) ) {
            lyropt.interactivity = lyropt.interactivity.join(',');
        }
        interactivity.push(lyropt.interactivity);

        var extra_opt = {};
        if ( lyropt.hasOwnProperty('raster_band') ) {
            extra_opt.band = lyropt.raster_band;
        }
        datasource_extend.push(mapConfig.getLayerDatasource(i));
        extra_ds_opts.push( extra_opt );
    }
    if ( ! sql.length ) {
        throw new Error("No 'mapnik' layers in MapConfig");
    }
    var opts = {
        sql: sql,
        style: style,
        style_version: style_version,
        interactivity: interactivity,
        ttl: 0,
        datasource_extend: datasource_extend,
        extra_ds_opts: extra_ds_opts
    };
    if (geom_columns.length) {
        opts.gcols = geom_columns;
    }

    return opts;
};

// Wrap SQL requests in mapnik format if sent
function prepareQuery(userSql, geomColumnName, geomColumnType) {

    // remove trailing ';'
    userSql = userSql.replace(/;\s*$/, '');

    geomColumnName = geomColumnName || COLUMN_NAME_DEFAULT;
    geomColumnType = geomColumnType || COLUMN_TYPE_DEFAULT;


    // By default the user query is used
    var sql = [userSql];

    if (snapToGridAndClipByBox2DQueryEnabled(geomColumnType)) {
        sql = [
            'WITH inner_cdbq as (' + userSql + ')',
            'SELECT *,',
            'CASE WHEN CDB_ScaleDenominatorToZoom(!scale_denominator!) > 8',
                'THEN ST_SnapToGrid(ST_ClipByBox2D(' +
                    geomColumnName + ', !bbox!), greatest(!pixel_width!,!pixel_height!)/20.0)',
                'ELSE ST_SnapToGrid(' + geomColumnName + ', greatest(!pixel_width!,!pixel_height!)/20.0)',
                'END ' + MAPNIK_COLUMN_NAME,
            'FROM inner_cdbq'
        ];
        geomColumnName = MAPNIK_COLUMN_NAME;
    } else if (snapToGridQueryEnabled(geomColumnType)) {
        sql = [
            'WITH inner_cdbq as (' + userSql + ')',
            'SELECT *, ST_SnapToGrid(' +
                geomColumnName + ', greatest(!pixel_width!,!pixel_height!)/20.0) ' + MAPNIK_COLUMN_NAME,
            'FROM inner_cdbq'
        ];
        geomColumnName = MAPNIK_COLUMN_NAME;
    }

    return {
        sql: '(' + sql.join(' ') + ') as cdbq',
        geomColumnName: geomColumnName,
        geomColumnType: geomColumnType
    };
}

function snapToGridQueryEnabled(geomColumnType) {
    return isGeometryColumnType(geomColumnType) && !!global.environment.renderer.snapToGrid;
}

function snapToGridAndClipByBox2DQueryEnabled(geomColumnType) {
    return isGeometryColumnType(geomColumnType) && !!global.environment.renderer.snapToGrid &&
        !!global.environment.renderer.clipByBox2d;
}

function isGeometryColumnType(geomColumnType) {
    return geomColumnType === COLUMN_TYPE_GEOMETRY;
}
