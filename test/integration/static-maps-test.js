'use strict';

require('../support/test-helper');

var assert = require('../support/assert');
var crypto = require('crypto');
var http = require('http');
var fs = require('fs');
var windshaft = require('../../lib');
var DummyMapConfigProvider = require('../../lib/models/providers/dummy-mapconfig-provider');
const path = require('path');
const config = require('../support/config');

var mapnik = require('@carto/mapnik');

describe('static maps', function () {
    var rendererFactory = new windshaft.renderer.Factory({
        mapnik: {
            grainstore: {
                cachedir: config.millstone.cache_basedir,
                mapnik_version: mapnik.versions.mapnik,
                gc_prob: 0 // run the garbage collector at each invocation
            },
            mapnik: {
                poolSize: 4, // require('os').cpus().length,
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
                src: path.join(__dirname, '../test/fixtures/http/basemap.png')
            }
        }
    });

    // initialize render cache
    var rendererCache = new windshaft.cache.RendererCache(rendererFactory);

    var previewBackend = new windshaft.backend.Preview(rendererCache);

    var validUrlTemplate = 'http://127.0.0.1:8033/{s}/{z}/{x}/{y}.png';
    var invalidUrlTemplate = 'http://127.0.0.1:8033/INVALID/{z}/{x}/{y}.png';

    var httpRendererResourcesServer;

    before(function (done) {
        // Start a server to test external resources
        httpRendererResourcesServer = http.createServer(function (request, response) {
            fs.readFile(path.join(__dirname, '../fixtures/http/basemap.png'), { encoding: 'binary' }, function (err, file) {
                assert.ifError(err);
                response.writeHead(200);
                response.write(file, 'binary');
                response.end();
            });
        });
        httpRendererResourcesServer.listen(8033, done);
    });

    after(function (done) {
        httpRendererResourcesServer.close(done);
    });

    function staticMapConfigProvider (urlTemplate, cartocss) {
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

    var zoom = 3;
    var lat = 0;
    var lon = 0;
    var width = 400;
    var height = 300;

    it('center image', function (done) {
        var provider = staticMapConfigProvider(validUrlTemplate);
        const options = {
            mapConfigProvider: provider,
            format: 'png',
            width,
            height,
            zoom,
            center: { lng: lon, lat: lat }
        };

        previewBackend.getImage(options, function (err, resource, stats) {
            if (err) {
                return done(err);
            }

            var image = mapnik.Image.fromBytesSync(Buffer.from(resource, 'binary'));
            assert.equal(image.width(), width);
            assert.equal(image.height(), height);

            assert.ok(Object.prototype.hasOwnProperty.call(stats, 'tiles'));
            assert.ok(Object.prototype.hasOwnProperty.call(stats, 'renderAvg'));

            done();
        });
    });

    it('center image with invalid basemap', function (done) {
        var provider = staticMapConfigProvider(invalidUrlTemplate);
        const options = {
            mapConfigProvider: provider,
            format: 'png',
            width,
            height,
            zoom,
            center: { lng: lon, lat: lat }
        };

        previewBackend.getImage(options, function (err, resource, stats) {
            if (err) {
                return done(err);
            }

            var image = mapnik.Image.fromBytesSync(Buffer.from(resource, 'binary'));
            assert.equal(image.width(), width);
            assert.equal(image.height(), height);

            assert.ok(Object.prototype.hasOwnProperty.call(stats, 'tiles'));
            assert.ok(Object.prototype.hasOwnProperty.call(stats, 'renderAvg'));

            done();
        });
    });

    var west = -90;
    var south = -45;
    var east = 90;
    var north = 45;
    var bWidth = 640;
    var bHeight = 480;

    it('bbox', function (done) {
        var provider = staticMapConfigProvider(validUrlTemplate);
        const options = {
            mapConfigProvider: provider,
            format: 'png',
            width: bWidth,
            height: bHeight,
            bbox: { west, south, east, north }
        };

        previewBackend.getImage(options, function (err, resource, stats) {
            if (err) {
                return done(err);
            }

            var image = mapnik.Image.fromBytesSync(Buffer.from(resource, 'binary'));
            assert.equal(image.width(), bWidth);
            assert.equal(image.height(), bHeight);

            assert.ok(Object.prototype.hasOwnProperty.call(stats, 'tiles'));
            assert.ok(Object.prototype.hasOwnProperty.call(stats, 'renderAvg'));

            done();
        });
    });

    it('should not fail for coordinates out of range', function (done) {
        var outOfRangeHeight = 3000;
        var provider = staticMapConfigProvider(validUrlTemplate);

        const options = {
            mapConfigProvider: provider,
            format: 'png',
            width,
            height: outOfRangeHeight,
            zoom: 1,
            center: { lng: lon, lat: lat }
        };

        previewBackend.getImage(options, function (err, resource, stats) {
            if (err) {
                return done(err);
            }

            var image = mapnik.Image.fromBytesSync(Buffer.from(resource, 'binary'));
            assert.equal(image.width(), width);
            assert.equal(image.height(), outOfRangeHeight);

            assert.ok(Object.prototype.hasOwnProperty.call(stats, 'tiles'));
            assert.ok(Object.prototype.hasOwnProperty.call(stats, 'renderAvg'));

            done();
        });
    });

    it('should keep failing for other errors', function (done) {
        var invalidStyleForZoom = '#layer { marker-fill:red; } #layer[zoom=' + zoom + '] { marker-width: [wadus] * 2; }';
        var provider = staticMapConfigProvider(validUrlTemplate, invalidStyleForZoom);

        const options = {
            mapConfigProvider: provider,
            format: 'png',
            width,
            height,
            zoom,
            center: { lng: lon, lat: lat }
        };

        previewBackend.getImage(options, function (err) {
            assert.ok(err);
            assert.ok(err.message.match(/column "wadus" does not exist/));

            done();
        });
    });
});
