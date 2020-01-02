'use strict';

require('../support/test_helper');

var assert = require('../support/assert');
var fs = require('fs');
var TestClient = require('../support/test_client');

var IMAGE_EQUALS_TOLERANCE_PER_MIL = 85;

describe('mapnik_render_by_format_quality', function () {
    var testClient;
    before(function (done) {
        testClient = new TestClient(layergroup, {
            mapnik: {
                grainstore: Object.assign({ mapnik_tile_format: 'png8:m=h' }, TestClient.grainstoreOptions)
            }
        });
        var testPngFilesDir = __dirname + '/../results/png';
        fs.readdirSync(testPngFilesDir)
            .filter(function (fileName) {
                return /.*\.png$/.test(fileName);
            })
            .map(function (fileName) {
                return testPngFilesDir + '/' + fileName;
            })
            .forEach(fs.unlinkSync);

        done();
    });

    function testOutputForPng32AndPng8 (tile, persist, callback) {
        it('intensity visualization; tile: ' + JSON.stringify(tile), function (done) {
            var options = { layer: 'mapnik' };
            var optionsForPng32 = Object.assign({ format: 'png32' }, options);

            testClient.getTile(tile.z, tile.x, tile.y, optionsForPng32, function (err, tileBuffer) {
                var bufferPng32 = tileBuffer;
                testClient.getTile(tile.z, tile.x, tile.y, options, function (err, tileBuffer) {
                    var bufferPng8 = tileBuffer;

                    assert.ok(bufferPng8.length < bufferPng32.length);
                    assert.imageBuffersAreEqual(bufferPng32, bufferPng8, IMAGE_EQUALS_TOLERANCE_PER_MIL, persist,
                        function (err, imagePaths, similarity) {
                            callback(err, imagePaths, similarity, done);
                        }
                    );
                });
            });
        });
    }

    var currentLevel = 3;
    var allLevelTiles = [];
    var maxLevelTile = Math.pow(2, currentLevel);

    for (var i = 0; i < maxLevelTile; i++) {
        for (var j = 0; j < maxLevelTile; j++) {
            allLevelTiles.push({
                z: currentLevel,
                x: i,
                y: j
            });
        }
    }

    var layergroup = {
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
                    cartocss_version: '2.3.0'
                }
            }
        ]
    };

    // when using PERSIST=true you can check differences in test/results/compare.html
    var PERSIST = false;

    var allImagePaths = [];
    var similarities = [];
    allLevelTiles.forEach(function (tile) {
        testOutputForPng32AndPng8(tile, PERSIST, function (err, imagePaths, similarity, done) {
            if (PERSIST) {
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
            }
            assert.ifError(err);
            done();
        });
    });
});
