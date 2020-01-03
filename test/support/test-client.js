'use strict';

var mapnik = require('@carto/mapnik');
var RedisPool = require('redis-mpool');

var windshaft = require('../../lib');
var DummyMapConfigProvider = require('../../lib/models/providers/dummy-mapconfig-provider');

const environment = require('./../../config/environments/test');

var redisClient = require('redis').createClient(environment.redis.port);

mapnik.register_system_fonts();
mapnik.register_default_fonts();

var grainstoreOptions = {
    carto_env: {
        validation_data: {
            fonts: Object.keys(mapnik.fontFiles())
        }
    },
    datasource: environment.postgres,
    cachedir: environment.millstone.cache_basedir,
    mapnik_version: environment.mapnik_version || mapnik.versions.mapnik
};
var rendererFactoryOptions = {
    mapnik: {
        grainstore: grainstoreOptions,
        mapnik: environment.renderer.mapnik
    },
    torque: environment.renderer.torque,
    http: environment.renderer.http
};

function TestClient (mapConfig, overrideOptions, onTileErrorStrategy) {
    const options = Object.assign({}, rendererFactoryOptions);
    overrideOptions = overrideOptions || {};

    Object.keys(overrideOptions).forEach(key => {
        options[key] = Object.assign({}, options[key], overrideOptions[key]);
    });

    if (onTileErrorStrategy) {
        options.onTileErrorStrategy = onTileErrorStrategy;
    }

    this.config = windshaft.model.MapConfig.create(mapConfig);

    this.rendererFactory = new windshaft.renderer.Factory(options);
    this.rendererCache = new windshaft.cache.RendererCache(this.rendererFactory);

    this.tileBackend = new windshaft.backend.Tile(this.rendererCache);
    this.attributesBackend = new windshaft.backend.Attributes();

    var mapValidatorBackend = new windshaft.backend.MapValidator(this.tileBackend, this.attributesBackend);
    var mapStore = new windshaft.storage.MapStore({
        pool: new RedisPool(environment.redis)
    });
    this.mapBackend = new windshaft.backend.Map(this.rendererCache, mapStore, mapValidatorBackend);
    this.previewBackend = new windshaft.backend.Preview(this.rendererCache);
}

module.exports = TestClient;

TestClient.prototype.getTile = function (z, x, y, options, callback) {
    if (!callback) {
        callback = options;
        options = {};
    }
    var params = Object.assign({
        dbname: 'windshaft_test',
        layer: 'all',
        format: 'png',
        z: z,
        x: x,
        y: y
    }, options);

    if (params.format === 'grid.json') {
        params.token = 'wadus';
    }

    var provider = new DummyMapConfigProvider(this.config, params);
    this.tileBackend.getTile(provider, params, function (err, tile, headers, stats) {
        var img;
        if (!err && tile && params.format === 'png') {
            img = mapnik.Image.fromBytesSync(Buffer.from(tile, 'binary'));
        }
        return callback(err, tile, img, headers, stats);
    });
};

TestClient.prototype.getFeatureAttributes = function (layer, featureId, callback) {
    var params = {
        dbname: 'windshaft_test',
        layer: layer,
        fid: featureId
    };
    var provider = new DummyMapConfigProvider(this.config, params);
    this.attributesBackend.getFeatureAttributes(provider, params, false, function (err, attributes, stats) {
        return callback(err, attributes, stats);
    });
};

TestClient.prototype.createLayergroup = function (options, callback) {
    if (!callback) {
        callback = options;
        options = {};
    }
    var params = Object.assign({
        dbname: 'windshaft_test'
    }, options);

    var validatorProvider = new DummyMapConfigProvider(this.config, params);
    this.mapBackend.createLayergroup(this.config, params, validatorProvider, function (err, layergroup) {
        if (layergroup) {
            var redisKey = 'map_cfg|' + layergroup.layergroupid;
            redisClient.del(redisKey, function () {
                return callback(err, layergroup);
            });
        } else {
            return callback(err);
        }
    });
};

function previewImageCallbackWrapper (callback) {
    return function (err, imageBuffer) {
        var image;
        if (!err) {
            image = mapnik.Image.fromBytesSync(Buffer.from(imageBuffer, 'binary'));
        }
        return callback(err, imageBuffer, image);
    };
}

TestClient.prototype.getStaticCenter = function (zoom, lon, lat, width, height, callback) {
    var format = 'png';
    var params = {
        layer: 'all',
        dbname: 'windshaft_test',
        format: format
    };
    const options = {
        mapConfigProvider: new DummyMapConfigProvider(this.config, params),
        format,
        width,
        height,
        zoom,
        center: {
            lng: lon,
            lat: lat
        }
    };

    this.previewBackend.getImage(options, previewImageCallbackWrapper(callback));
};

TestClient.prototype.getStaticBbox = function ({ west, south, east, north, width, height }, callback) {
    var format = 'png';
    var params = {
        layer: 'all',
        dbname: 'windshaft_test',
        format: format
    };
    var provider = new DummyMapConfigProvider(this.config, params);

    const options = {
        mapConfigProvider: provider,
        format,
        width,
        height,
        bbox: { west, south, east, north }
    };

    this.previewBackend.getImage(options, previewImageCallbackWrapper(callback));
};

var DEFAULT_POINT_STYLE = [
    '#layer {',
    '  marker-fill: #FF6600;',
    '  marker-opacity: 1;',
    '  marker-width: 16;',
    '  marker-line-color: white;',
    '  marker-line-width: 3;',
    '  marker-line-opacity: 0.9;',
    '  marker-placement: point;',
    '  marker-type: ellipse;',
    '  marker-allow-overlap: true;',
    '}'
].join('');

function singleLayerMapConfig (sql, cartocss, cartocssVersion, interactivity, attributes) {
    return {
        version: '1.3.0',
        layers: [
            {
                type: 'mapnik',
                options: {
                    sql: sql,
                    cartocss: cartocss || DEFAULT_POINT_STYLE,
                    cartocss_version: cartocssVersion || '2.3.0',
                    interactivity: interactivity,
                    attributes: attributes || undefined
                }
            }
        ]
    };
}

function mvtLayerMapConfig (sql, geom_column = 'the_geom', srid = 3857) {
    return {
        version: '1.8.0',
        layers: [
            {
                type: 'mapnik',
                options: {
                    geom_column: geom_column,
                    srid: srid,
                    sql: sql
                }
            }
        ]
    };
}

function defaultTableQuery (tableName) {
    return `SELECT * FROM ${tableName}`;
}

function defaultTableMapConfig (tableName, cartocss, cartocssVersion, interactivity) {
    return singleLayerMapConfig(defaultTableQuery(tableName), cartocss, cartocssVersion, interactivity);
}

module.exports.singleLayerMapConfig = singleLayerMapConfig;
module.exports.defaultTableMapConfig = defaultTableMapConfig;
module.exports.mvtLayerMapConfig = mvtLayerMapConfig;

module.exports.grainstoreOptions = grainstoreOptions;
module.exports.redisOptions = environment.redis;
module.exports.millstoneOptions = environment.millstone;
module.exports.mapnikOptions = environment.renderer.mapnik;
module.exports.mapnik_version = environment.mapnik_version;
