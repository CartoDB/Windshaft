require('../support/test_helper');

var assert = require('../support/assert');
var _ = require('underscore');
var fs = require('fs');
var redis = require('redis');
var Windshaft     = require('../../lib/windshaft');
var ServerOptions = require('../support/server_options');

var IMAGE_EQUALS_TOLERANCE_PER_MIL = 85;

describe('Mapnik get tile by format quality', function() {

    var server = new Windshaft.Server(ServerOptions);

    server.setMaxListeners(0);

    var redisClient = redis.createClient(ServerOptions.redis.port);

    var layergroupId;

    before(function(done) {
        var testPngFilesDir = __dirname + '/../results/png';
        fs.readdirSync(testPngFilesDir)
            .filter(function(fileName) {
                return /.*\.png$/.test(fileName);
            })
            .map(function(fileName) {
                return testPngFilesDir + '/' + fileName;
            })
            .forEach(fs.unlinkSync);

        done();
    });

    function testOutputForPng32AndPng8(desc, tile, callback) {

        var bufferPng32,
            bufferPng8;

        it(desc + '; tile: ' + JSON.stringify(tile),  function(done){
            assert.response(
                server,
                {
                    url: '/database/windshaft_test/layergroup',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    data: JSON.stringify(layergroup)
                },
                {
                    status: 200
                },
                function(res, err) {
                    if (err) {
                        return done(err);
                    }

                    layergroupId = JSON.parse(res.body).layergroupid;

                    var tilePartialUrlPng8 =  _.template('/<%= z %>/<%= x %>/<%= y %>.png', tile);

                    var requestPayloadPng8 = {
                        url: '/database/windshaft_test/layergroup/' + layergroupId + tilePartialUrlPng8,
                        method: 'GET',
                        encoding: 'binary'
                    };

                    var tilePartialUrlPng32 =  _.template('/<%= z %>/<%= x %>/<%= y %>.png32', tile);

                    var requestPayloadPng32 = {
                        url: '/database/windshaft_test/layergroup/' + layergroupId + tilePartialUrlPng32,
                        method: 'GET',
                        encoding: 'binary'
                    };

                    var requestHeaders = {
                        status: 200,
                        headers: {
                            'Content-Type': 'image/png'
                        }
                    };

                    assert.response(server, requestPayloadPng32, requestHeaders, function(responsePng32) {
                        assert.equal(responsePng32.headers['content-type'], "image/png");
                        bufferPng32 = responsePng32.body;
                        assert.response(server, requestPayloadPng8, requestHeaders, function(responsePng8) {
                            assert.equal(responsePng8.headers['content-type'], "image/png");
                            bufferPng8 = responsePng8.body;
                            assert.imageBuffersAreEqual(bufferPng32, bufferPng8, IMAGE_EQUALS_TOLERANCE_PER_MIL,
                                function(err, imagePaths, similarity) {
                                    redisClient.del('map_cfg|' + layergroupId, function() {
                                        callback(err, imagePaths, similarity, done);
                                    });
                                }
                            );
                        });
                    });
                }
            );
        });
    }


    var currentLevel = 2,
        allLevelTiles = [],
        maxLevelTile = Math.pow(2, currentLevel);

    for (var i = 0; i < maxLevelTile; i++) {
        for (var j = 0; j < maxLevelTile; j++) {
            allLevelTiles.push({
                z: currentLevel,
                x: i,
                y: j
            });
        }
    }

    var layergroup =  {
        version: '1.3.0',
        layers: [
            {
                options: {
                    sql: 'SELECT * FROM populated_places_simple_reduced',
                    cartocss: [
                        '#populated_places_simple_reduced {',
                            'marker-fill: #FFCC00;',
                            'marker-width: 10;',
                            'marker-line-color: #FFF;',
                            'marker-line-width: 1.5;',
                            'marker-line-opacity: 1;',
                            'marker-fill-opacity: 0.9;',
                            'marker-comp-op: multiply;',
                            'marker-type: ellipse;',
                            'marker-placement: point;',
                            'marker-allow-overlap: true;',
                            'marker-clip: false;',
                        '}'
                    ].join(' '),
                    cartocss_version: '2.0.1'
                }
            }
        ]
    };

    var allImagePaths = [],
        similarities = [];
    allLevelTiles.forEach(function(tile) {
        testOutputForPng32AndPng8('intensity visualization', tile, function(err, imagePaths, similarity, done) {
            allImagePaths.push(imagePaths);
            similarities.push(similarity);
            var transformPaths = [];
            for (var i = 0, len = allImagePaths.length; i < len; i++) {
                if (similarities[i] > 0.075) {
                    transformPaths.push({
                        passive: allImagePaths[i][0],
                        active: allImagePaths[i][1],
                        similarity: similarities[i]
                    });
                }
            }
            var output = 'handleResults(' + JSON.stringify(transformPaths) + ');';
            fs.writeFileSync('test/results/png/results.js', output);
            assert.ifError(err);
            done();
        });
    });
});
