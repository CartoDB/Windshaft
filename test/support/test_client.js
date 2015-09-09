var _ = require('underscore');
var windshaft = require('../../lib/windshaft');

var rendererOptions = global.environment.renderer;
var grainstoreOptions = {
    datasource: global.environment.postgres,
    cachedir: global.environment.millstone.cache_basedir,
    mapnik_version: global.environment.mapnik_version || windshaft.mapnik.versions.mapnik
};
var rendererFactoryOptions = {
    mapnik: {
        grainstore: grainstoreOptions,
        mapnik: rendererOptions.mapnik
    },
    torque: rendererOptions.torque,
    http: rendererOptions.http
};

function TestClient(mapConfig) {
    this.rendererFactory = new windshaft.renderer.Factory(rendererFactoryOptions);
    this.config = windshaft.model.MapConfig.create(mapConfig);
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
        format: 'png'
    }, options);

    var context = {};

    this.rendererFactory.getRenderer(this.config, params, context, function(err, renderer) {
        if (err) {
            return callback(err);
        }
        renderer.getTile(z, x, y, callback);
    });
};

