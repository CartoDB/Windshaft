'use strict';

require('../support/test_helper');

var assert = require('../support/assert');
var TestClient = require('../support/test_client');

describe('retina support', function () {
    var testClient;

    before(function () {
        var retinaSampleMapConfig = {
            version: '1.2.0',
            layers: [
                {
                    options: {
                        sql: 'SELECT * FROM populated_places_simple_reduced',
                        cartocss: '#layer { marker-fill:red; } #layer { marker-width: 2; }',
                        cartocss_version: '2.3.0'
                    }
                }
            ]
        };
        testClient = new TestClient(retinaSampleMapConfig);
    });

    function testRetinaImage (scaleFactor, assertFn) {
        testClient.getTile(0, 0, 0, { scale_factor: scaleFactor }, assertFn);
    }

    function testValidImageDimensions (scaleFactor, imageSize, done) {
        testRetinaImage(scaleFactor, function (err, tile, image) {
            assert.ok(!err, 'Failed to request 0/0/0' + scaleFactor + '.png tile');

            assert.equal(image.width(), imageSize);
            assert.equal(image.height(), imageSize);
            done();
        });
    }

    it('image dimensions when scale factor is not defined', function (done) {
        testValidImageDimensions(undefined, 256, done);
    });

    it('image dimensions when scale factor = @1x', function (done) {
        testValidImageDimensions(1, 256, done);
    });

    it('image dimensions when scale factor = @2x', function (done) {
        testValidImageDimensions(2, 512, done);
    });

    it('error when scale factor is not enabled', function (done) {
        var scaleFactor = 4;

        testRetinaImage(scaleFactor, function (err) {
            assert.ok(err);
            assert.deepEqual(err.message, 'Tile with specified resolution not found');

            done();
        });
    });
});
