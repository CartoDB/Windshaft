require('../support/test_helper');

var assert = require('../support/assert');
var redis = require('redis');
var mapnik = require('mapnik');
var Windshaft = require('../../lib/windshaft');
var ServerOptions = require('../support/server_options');

describe('retina support', function() {

    var layergroupId = null;

    var server = new Windshaft.Server(ServerOptions);
    server.setMaxListeners(0);
    var redis_client = redis.createClient(ServerOptions.redis.port);

    beforeEach(function(done) {
        var retinaSampleMapConfig =  {
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

        assert.response(server,
            {
                url: '/database/windshaft_test/layergroup',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                data: JSON.stringify(retinaSampleMapConfig)
            },
            {

            },
            function (res, err) {
                assert.ok(!err, 'Failed to create layergroup');

                layergroupId = JSON.parse(res.body).layergroupid;

                done();
            }
        );
    });


    function testRetinaImage(scaleFactor, responseHead, assertFn) {
        assert.response(server,
            {
                url: '/database/windshaft_test/layergroup/' + layergroupId + '/0/0/0' + scaleFactor + '.png',
                method: 'GET',
                encoding: 'binary'
            },
            responseHead,
            assertFn
        );
    }

    function testValidImageDimmensions(scaleFactor, imageSize, done) {
        testRetinaImage(scaleFactor,
            {
                status: 200,
                headers: {
                    'Content-Type': 'image/png'
                }
            },
            function(res, err) {
                assert.ok(!err, 'Failed to request 0/0/0' + scaleFactor + '.png tile');

                var image = new mapnik.Image.fromBytes(new Buffer(res.body, 'binary'));

                assert.equal(image.width(), imageSize);
                assert.equal(image.height(), imageSize);
                done();
            }
        );
    }

    it('image dimensions when scale factor is not defined', function(done) {
        testValidImageDimmensions('', 256, done);
    });

    it('image dimensions when scale factor = @1x', function(done) {
        testValidImageDimmensions('@1x', 256, done);
    });

    it('image dimensions when scale factor = @2x', function(done) {
        testValidImageDimmensions('@2x', 512, done);
    });

    it('error when scale factor is not enabled', function(done) {

        var scaleFactor = '@4x';

        testRetinaImage(scaleFactor,
            {
                status: 404,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                }
            },
            function(res, err) {
                assert.ok(!err, 'Failed to request 0/0/0' + scaleFactor + '.png tile');
                assert.deepEqual(JSON.parse(res.body), { errors: ["Tile with specified resolution not found"] } );

                done();
            }
        );
    });

    afterEach(function(done) {
        var redisKey = 'map_cfg|' + layergroupId;
        redis_client.del(redisKey, function () {
            done();
        });
    });
});
