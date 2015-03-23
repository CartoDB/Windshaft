require('../support/test_helper');
var assert = require('../support/assert');
var redis = require('redis');
var testClient = require('../support/test_client');
var http = require('http');
var fs = require('fs');

suite('static_maps', function() {

    var redisClient = redis.createClient(global.environment.redis.port);

    var validUrlTemplate = 'http://127.0.0.1:8033/{s}/{z}/{x}/{y}.png';
    var invalidUrlTemplate = 'http://127.0.0.1:8033/INVALID/{z}/{x}/{y}.png';

    var httpRendererResourcesServer;

    suiteSetup(function(done) {
        // Check that we start with an empty redis db
        redisClient.keys("*", function(err, matches) {
            if (err) {
                return done(err);
            }
            assert.equal(matches.length, 0, "redis keys present at setup time:\n" + matches.join("\n"));

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
    });

    function staticMapConfig(urlTemplate) {
        return {
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
                        cartocss: '#layer { marker-fill:red; } #layer { marker-width: 2; }',
                        cartocss_version: '2.3.0'
                    }
                }
            ]
        };
    }

    var zoom = 3,
        lat = 0,
        lon = 0,
        width = 400,
        height = 300;

    test('center image', function (done) {
        var mapConfig = staticMapConfig(validUrlTemplate);
        testClient.getStaticCenter(mapConfig, zoom, lat, lon, width, height, function(err, res, image) {
            if (err) {
                return done(err);
            }

            assert.equal(image.width(), width);
            assert.equal(image.height(), height);

            done();
        });
    });

    test('center image with invalid basemap', function (done) {
        var mapConfig = staticMapConfig(invalidUrlTemplate);
        testClient.getStaticCenter(mapConfig, zoom, lat, lon, width, height, function(err, res, image) {
            if (err) {
                return done(err);
            }

            assert.equal(image.width(), width);
            assert.equal(image.height(), height);

            done();
        });
    });

    var west = -90,
        south = -45,
        east = 90,
        north = 45,
        bbWidth = 640,
        bbHeight = 480;

    test('bbox', function (done) {
        var mapConfig = staticMapConfig(validUrlTemplate);
        testClient.getStaticBbox(mapConfig, west, south, east, north, bbWidth, bbHeight, function(err, res, image) {
            if (err) {
                return done(err);
            }

            assert.equal(image.width(), bbWidth);
            assert.equal(image.height(), bbHeight);

            done();
        });
    });

    suiteTeardown(function(done) {
        httpRendererResourcesServer.close();

        // Check that we left the redis db empty
        redisClient.keys("*", function(err, matches) {
            try {
                assert.equal(matches.length, 0, "Left over redis keys:\n" + matches.join("\n"));
            } catch (err2) {
                if (err) {
                    err.message += '\n' + err2.message;
                } else {
                    err = err2;
                }
            }
            redisClient.flushall(function() {
                return done(err);
            });
        });
    });
});
