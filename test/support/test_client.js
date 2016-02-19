var _ = require('underscore');
var mapnik = require('mapnik');
var RedisPool = require('redis-mpool');

var windshaft = require('../../lib/windshaft');
var DummyMapConfigProvider = require('../../lib/windshaft/models/providers/dummy_mapconfig_provider');

var redisClient = require('redis').createClient(global.environment.redis.port);

mapnik.register_system_fonts();
mapnik.register_default_fonts();
var cartoEnv = {
    validation_data: {
        fonts: _.keys(mapnik.fontFiles())
    }
};

var rendererOptions = global.environment.renderer;
var grainstoreOptions = {
    carto_env: cartoEnv,
    datasource: global.environment.postgres,
    cachedir: global.environment.millstone.cache_basedir,
    mapnik_version: global.environment.mapnik_version || mapnik.versions.mapnik
};
var rendererFactoryOptions = {
    mapnik: {
        grainstore: grainstoreOptions,
        mapnik: rendererOptions.mapnik
    },
    torque: rendererOptions.torque,
    http: rendererOptions.http
};

function TestClient(mapConfig, overrideOptions, onTileErrorStrategy) {
    var options = _.extend({}, rendererFactoryOptions);
    overrideOptions = overrideOptions || {};
    _.each(overrideOptions, function(overrideConfig, key) {
        options[key] = _.extend({}, options[key], overrideConfig);
    });

    if (onTileErrorStrategy) {
        options.onTileErrorStrategy = onTileErrorStrategy;
    }

    this.config = windshaft.model.MapConfig.create(mapConfig);

    this.rendererFactory = new windshaft.renderer.Factory(options);
    this.rendererCache = new windshaft.cache.RendererCache(this.rendererFactory);

    this.tileBackend = new windshaft.backend.Tile(this.rendererCache);
    this.attributesBackend = new windshaft.backend.Attributes();
    this.widgetBackend = new windshaft.backend.Widget();

    var mapValidatorBackend = new windshaft.backend.MapValidator(this.tileBackend, this.attributesBackend);
    var mapStore = new windshaft.storage.MapStore({
        pool: new RedisPool(global.settings.redis)
    });
    this.mapBackend = new windshaft.backend.Map(this.rendererCache, mapStore, mapValidatorBackend);
    this.previewBackend = new windshaft.backend.Preview(this.rendererCache);
}

module.exports = TestClient;

TestClient.prototype.getTile = function(z, x, y, options, callback) {
    if (!callback) {
        callback = options;
        options = {};
    }
    var params = _.extend({
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
    this.tileBackend.getTile(provider, params, function(err, tile, headers, stats) {
        var img;
        if (!err && tile && params.format === 'png') {
            img = mapnik.Image.fromBytesSync(new Buffer(tile, 'binary'));
        }
        return callback(err, tile, img, headers, stats);
    });
};

TestClient.prototype.getFeatureAttributes = function(layer, featureId, callback) {
    var params = {
        dbname: 'windshaft_test',
        layer: layer,
        fid: featureId
    };
    var provider = new DummyMapConfigProvider(this.config, params);
    this.attributesBackend.getFeatureAttributes(provider, params, false, function(err, attributes, stats) {
        return callback(err, attributes, stats);
    });
};

TestClient.prototype.getWidget = function(layer, widgetName, override, callback) {
    if (!callback) {
        callback = override;
        override = {};
    }
    var params = {
        dbname: 'windshaft_test',
        layer: layer,
        widgetName: widgetName
    };
    var provider = new DummyMapConfigProvider(this.config, params);
    this.widgetBackend.getWidget(provider, _.extend(override, params), callback);
};

TestClient.prototype.widgetSearch = function(layer, widgetName, userQuery, override, callback) {
    if (!callback) {
        callback = override;
        override = {};
    }
    var params = {
        dbname: 'windshaft_test',
        layer: layer,
        widgetName: widgetName,
        q: userQuery
    };
    var provider = new DummyMapConfigProvider(this.config, params);
    this.widgetBackend.search(provider, _.extend(override, params), callback);
};

TestClient.prototype.setLayersFiltersParamsSync = function(filters) {
    this.config.setFiltersParamsSync({ layers: filters });
};

TestClient.prototype.setLayersFiltersParams = function(filters, callback) {
    var params = {
        dbname: 'windshaft_test'
    };
    this.config.setFiltersParams({ layers: filters }, params, callback);
};


TestClient.prototype.createLayergroup = function(options, callback) {
    if (!callback) {
        callback = options;
        options = {};
    }
    var params = _.extend({
        dbname: 'windshaft_test'
    }, options);

    var validatorProvider = new DummyMapConfigProvider(this.config, params);
    this.mapBackend.createLayergroup(this.config, params, validatorProvider, function(err, layergroup) {
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

function previewImageCallbackWrapper(callback) {
    return function(err, imageBuffer) {
        var image;
        if (!err) {
            image = mapnik.Image.fromBytesSync(new Buffer(imageBuffer, 'binary'));
        }
        return callback(err, imageBuffer, image);
    };
}

TestClient.prototype.getStaticCenter = function(zoom, lon, lat, width, height, callback) {
    var format = 'png';
    var params = {
        layer: 'all',
        dbname: 'windshaft_test',
        format: format
    };
    var provider = new DummyMapConfigProvider(this.config, params);
    var center = {
        lng: lon,
        lat: lat
    };
    this.previewBackend.getImage(provider, format, width, height, zoom, center, previewImageCallbackWrapper(callback));
};

TestClient.prototype.getStaticBbox = function(west, south, east, north, width, height, callback) {
    var format = 'png';
    var params = {
        layer: 'all',
        dbname: 'windshaft_test',
        format: format
    };
    var provider = new DummyMapConfigProvider(this.config, params);
    var bounds = {
        west: west,
        south: south,
        east: east,
        north: north
    };
    this.previewBackend.getImage(provider, format, width, height, bounds, previewImageCallbackWrapper(callback));
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

function singleLayerMapConfig(sql, cartocss, cartocssVersion, interactivity, attributes) {
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
                    attributes: attributes ? attributes : undefined
                }
            }
        ]
    };
}

function defaultTableQuery(tableName) {
    return _.template('SELECT * FROM <%= tableName %>', {tableName: tableName});
}

function defaultTableMapConfig(tableName, cartocss, cartocssVersion, interactivity) {
    return singleLayerMapConfig(defaultTableQuery(tableName), cartocss, cartocssVersion, interactivity);
}

module.exports.singleLayerMapConfig = singleLayerMapConfig;
module.exports.defaultTableMapConfig = defaultTableMapConfig;

module.exports.grainstoreOptions = grainstoreOptions;
module.exports.mapnikOptions = rendererOptions.mapnik;
