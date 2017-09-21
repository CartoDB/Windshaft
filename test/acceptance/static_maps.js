require('../support/test_helper');

var assert = require('../support/assert');
var TestClient = require('../support/test_client');
var http = require('http');
var fs = require('fs');
var Renderer = require('../../lib/windshaft/renderers/http/renderer');
var mapnik = require('mapnik');
var assert = require('../support/assert');

describe('static_maps', function() {

    var IMAGE_EQUALS_TOLERANCE_PER_MIL = 25;

    var urlHost = 'http://127.0.0.1:8033';
    var validUrlTemplate = urlHost + '/{s}/{z}/{x}/{y}.png';
    var invalidUrlTemplate = urlHost + '/INVALID/{z}/{x}/{y}.png';
    var retinaUrlPath = '/@2x';

    var filepathRegular = __dirname + '/../fixtures/http/basemap.png';
    var filepathRetina = __dirname + '/../fixtures/http/mapbox-tile@2x.png';

    var httpRendererResourcesServer;

    before(function(done) {
        // Start a server to test external resources
        httpRendererResourcesServer = http.createServer( function(request, response) {
            var filenpath = request.url === retinaUrlPath ? filepathRetina : filepathRegular;

            fs.readFile(filenpath, {encoding: 'binary'}, function(err, file) {
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

    function staticMapConfig(urlTemplate, cartocss) {
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
                        cartocss: cartocss || '#layer { marker-fill:red; } #layer { marker-width: 2; }',
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
        var testClient = new TestClient(staticMapConfig(validUrlTemplate));
        testClient.getStaticCenter(zoom, lon, lat, width, height, function(err, imageBuffer, image) {
            assert.ok(!err);
            assert.equal(image.width(), width);
            assert.equal(image.height(), height);

            done();
        });
    });

    it('center image with invalid basemap', function (done) {
        var testClient = new TestClient(staticMapConfig(invalidUrlTemplate));
        testClient.getStaticCenter(zoom, lon, lat, width, height, function(err, imageBuffer, image) {
            assert.ok(!err);

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
        var testClient = new TestClient(staticMapConfig(validUrlTemplate));
        testClient.getStaticBbox(west, south, east, north, bbWidth, bbHeight, function(err, imageBuffer, image) {
            assert.ok(!err);

            assert.equal(image.width(), bbWidth);
            assert.equal(image.height(), bbHeight);

            done();
        });
    });

    it('should not fail for coordinates out of range', function (done) {
        var outOfRangeHeight = 3000;
        var testClient = new TestClient(staticMapConfig(validUrlTemplate));
        testClient.getStaticCenter(1, lat, lon, width, outOfRangeHeight, function(err, imageBuffer, image) {
            assert.ok(!err);

            assert.equal(image.width(), width);
            assert.equal(image.height(), outOfRangeHeight);

            done();
        });
    });

    it('should keep failing for other errors', function (done) {
        var invalidStyleForZoom = '#layer { marker-fill:red; } #layer[zoom='+zoom+'] { marker-width: [wadus] * 2; }';
        var testClient = new TestClient(staticMapConfig(validUrlTemplate, invalidStyleForZoom));
        testClient.getStaticCenter(zoom, lat, lon, width, height, function(err) {
            assert.ok(err);
            assert.ok(err.message.match(/column \"wadus\" does not exist/));
            done();
        });
    });

    it('resize tiles bigger than 256px', function (done) {
        var renderer = new Renderer(urlHost + retinaUrlPath, [], {});
        /* jshint unused: vars */
        renderer.getTile(0, 0, 0, function(err, buffer, headers, stats){
            mapnik.Image.fromBytes(buffer, function(err, image) {
                assert.ifError(err);
                assert.ok(image.height() === 256 && image.width() === 256, 'Tile not resized to 256x256px');

                var referenceImage = mapnik.Image.fromBytesSync(fs.readFileSync(filepathRetina,  { encoding: null }));
                assert.imagesAreSimilarIgnoreDimensions(
                    image, 
                    referenceImage, 
                    IMAGE_EQUALS_TOLERANCE_PER_MIL, 
                    function(err, similarity) {
                        assert.ifError(err);
                        done();        
                    }
                );
            });
        });
    });
});
