'use strict';

require('../support/test_helper');

var assert = require('../support/assert');
var crypto = require('crypto');
var http = require('http');
var fs = require('fs');
var windshaft = require('../../lib/windshaft');
var DummyMapConfigProvider = require('../../lib/windshaft/models/providers/dummy_mapconfig_provider');

var mapnik = require('@carto/mapnik');
//var RedisPool = require('redis-mpool');

describe('static_maps', function() {

//    var redisPool = new RedisPool(global.environment.redis);
//    var mapStore  = new windshaft.storage.MapStore({ pool: redisPool });

    var rendererFactory = new windshaft.renderer.Factory({
        mapnik: {
            grainstore: {
                datasource: global.environment.postgres,
                cachedir: global.environment.millstone.cache_basedir,
                mapnik_version: global.environment.mapnik_version || mapnik.versions.mapnik,
                gc_prob: 0 // run the garbage collector at each invocation
            },
            mapnik: {
                poolSize: 4,//require('os').cpus().length,
                metatile: 1,
                bufferSize: 64,
                snapToGrid: false,
                clipByBox2d: false, // this requires postgis >=2.2 and geos >=3.5
                scale_factors: [1, 2],
                metrics: false,
                limits: {
                    render: 0,
                    cacheOnTimeout: true
                }
            }
        },
        http: {
            timeout: 5000,
            whitelist: ['http://127.0.0.1:8033/{s}/{z}/{x}/{y}.png'],
            fallbackImage: {
                type: 'fs',
                src: __dirname + '/../../test/fixtures/http/basemap.png'
            }
        }
    });

    // initialize render cache
    var rendererCache = new windshaft.cache.RendererCache(rendererFactory);

    var previewBackend = new windshaft.backend.Preview(rendererCache);

    var validUrlTemplate = 'http://127.0.0.1:8033/{s}/{z}/{x}/{y}.png';
    var invalidUrlTemplate = 'http://127.0.0.1:8033/INVALID/{z}/{x}/{y}.png';

    var httpRendererResourcesServer;

    before(function(done) {
        // Start a server to test external resources
        httpRendererResourcesServer = http.createServer( function(request, response) {
            var filename = __dirname + '/../fixtures/http/basemap.png';
            fs.readFile(filename, {encoding: 'binary'}, function(err, file) {
                response.writeHead(200);
                response.write(file, "binary");
                response.end();
            });
        });
        httpRendererResourcesServer.listen(8033, done);
    });

    after(function(done) {
        httpRendererResourcesServer.close(done);
    });

    function staticMapConfigProvider(urlTemplate, cartocss) {
        var layergroup = {
            version: '1.2.0',
            layers: [
                {
                    type: 'http',
                    options: {
                        urlTemplate: urlTemplate,
                        subdomains: ['abcd']
                    }
                },
                {
                    type: 'mapnik',
                    options: {
                        sql: 'SELECT * FROM populated_places_simple_reduced',
                        cartocss: cartocss || '#layer { marker-fill:red; } #layer { marker-width: 2; }',
                        cartocss_version: '2.3.0'
                    }
                }
            ]
        };
        var mapConfig = windshaft.model.MapConfig.create(layergroup);
        var defaultParams = {
            dbname: 'windshaft_test',
            token: crypto.createHash('md5').update(JSON.stringify(layergroup)).digest('hex'),
            format: 'png',
            layer: 'all'
        };
        return new DummyMapConfigProvider(mapConfig, defaultParams);
    }

    var zoom = 3,
        lat = 0,
        lon = 0,
        width = 400,
        height = 300;

    it('center image', function (done) {
        var provider = staticMapConfigProvider(validUrlTemplate);
        previewBackend.getImage(provider, 'png', width, height, zoom, {lng: lon, lat: lat},
            function(err, resource, stats) {
                if (err) {
                    return done(err);
                }

                var image = new mapnik.Image.fromBytesSync(new Buffer(resource, 'binary'));
                assert.equal(image.width(), width);
                assert.equal(image.height(), height);

                assert.ok(stats.hasOwnProperty('tiles'));
                assert.ok(stats.hasOwnProperty('renderAvg'));

                done();
            }
        );
    });

    it('center image with invalid basemap', function (done) {
        var provider = staticMapConfigProvider(invalidUrlTemplate);
        previewBackend.getImage(provider, 'png', width, height, zoom, {lng: lon, lat: lat},
            function(err, resource, stats) {
                if (err) {
                    return done(err);
                }

                var image = new mapnik.Image.fromBytesSync(new Buffer(resource, 'binary'));
                assert.equal(image.width(), width);
                assert.equal(image.height(), height);

                assert.ok(stats.hasOwnProperty('tiles'));
                assert.ok(stats.hasOwnProperty('renderAvg'));

                done();
            }
        );
    });

    var west = -90,
        south = -45,
        east = 90,
        north = 45,
        bWidth = 640,
        bHeight = 480;

    it('bbox', function (done) {
        var provider = staticMapConfigProvider(validUrlTemplate);
        previewBackend.getImage(provider, 'png', bWidth, bHeight, {west: west, south: south, east: east, north: north},
            function(err, resource, stats) {
                if (err) {
                    return done(err);
                }

                var image = new mapnik.Image.fromBytesSync(new Buffer(resource, 'binary'));
                assert.equal(image.width(), bWidth);
                assert.equal(image.height(), bHeight);

                assert.ok(stats.hasOwnProperty('tiles'));
                assert.ok(stats.hasOwnProperty('renderAvg'));

                done();
            }
        );
    });

    it('should not fail for coordinates out of range', function (done) {
        var outOfRangeHeight = 3000;
        var provider = staticMapConfigProvider(invalidUrlTemplate);
        previewBackend.getImage(provider, 'png', width, outOfRangeHeight, 1, {lng: lon, lat: lat},
            function(err, resource, stats) {
                if (err) {
                    return done(err);
                }

                var image = new mapnik.Image.fromBytesSync(new Buffer(resource, 'binary'));
                assert.equal(image.width(), width);
                assert.equal(image.height(), outOfRangeHeight);

                assert.ok(stats.hasOwnProperty('tiles'));
                assert.ok(stats.hasOwnProperty('renderAvg'));

                done();
            }
        );
    });

    it('should keep failing for other errors', function (done) {
        var invalidStyleForZoom = '#layer { marker-fill:red; } #layer[zoom='+zoom+'] { marker-width: [wadus] * 2; }';
        var provider = staticMapConfigProvider(validUrlTemplate, invalidStyleForZoom);
        previewBackend.getImage(provider, 'png', width, height, zoom, {lng: lon, lat: lat}, function(err) {
            assert.ok(err);
            assert.ok(err.message.match(/column \"wadus\" does not exist/));

            done();
        });
    });

});
