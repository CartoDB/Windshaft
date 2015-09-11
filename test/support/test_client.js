var _ = require('underscore');
var mapnik = require('mapnik');
var RedisPool = require('redis-mpool');

var windshaft = require('../../lib/windshaft');
var DummyMapConfigProvider = require('../../lib/windshaft/models/dummy_mapconfig_provider');
var OldTestClient = require('./test_client_old');

var rendererOptions = global.environment.renderer;
var grainstoreOptions = {
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

function TestClient(mapConfig, overrideOptions) {
    var options = _.extend({}, rendererFactoryOptions);
    overrideOptions = overrideOptions || {};
    _.each(overrideOptions, function(overrideConfig, key) {
        options[key] = _.extend(options[key], overrideConfig);
    });

    this.config = windshaft.model.MapConfig.create(mapConfig);

    this.rendererFactory = new windshaft.renderer.Factory(rendererFactoryOptions);
    this.rendererCache = new windshaft.cache.RendererCache(this.rendererFactory);

    this.tileBackend = new windshaft.backend.Tile(this.rendererCache);
    this.attributesBackend = new windshaft.backend.Attributes();

    var mapValidatorBackend = new windshaft.backend.MapValidator(this.tileBackend, this.attributesBackend);
    var mapStore = new windshaft.storage.MapStore({
        pool: new RedisPool(global.settings.redis)
    });
    this.mapBackend = new windshaft.backend.Map(this.rendererCache, mapStore, mapValidatorBackend);
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

TestClient.prototype.createLayergroup = function(callback) {
    var params = {
        dbname: 'windshaft_test'
    };
    var validatorProvider = new DummyMapConfigProvider(this.config, params);
    this.mapBackend.createLayergroup(this.config, params, validatorProvider, callback);
};

module.exports.singleLayerMapConfig = OldTestClient.singleLayerMapConfig;
module.exports.defaultTableMapConfig = OldTestClient.defaultTableMapConfig;

module.exports.grainstoreOptions = grainstoreOptions;
