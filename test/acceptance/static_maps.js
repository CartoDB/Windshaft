require('../support/test_helper');

var assert = require('../support/assert');
var testClient = require('../support/test_client');
var http = require('http');
var fs = require('fs');

describe('static_maps', function() {

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

    it('center image', function (done) {
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

    it('center image with invalid basemap', function (done) {
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

    it('bbox', function (done) {
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

});
