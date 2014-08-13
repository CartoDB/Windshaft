var   assert        = require('../support/assert')
    , _             = require('underscore')
    , querystring   = require('querystring')
    , fs            = require('fs')
    , path          = require('path')
    , redis         = require('redis')
    , th            = require('../support/test_helper')
    , Windshaft     = require('../../lib/windshaft')
    , ServerOptions = require('../support/server_options');

function rmdir_recursive_sync(dirname) {
    var files = fs.readdirSync(dirname);
    for (var i=0; i<files.length; ++i) {
        var f = dirname + "/" + files[i];
        var s = fs.lstatSync(f);
        if ( s.isFile() ) {
            console.log("Unlinking " + f);
            fs.unlinkSync(f)
        }
        else rmdir_recursive_sync(f);
    }
}

var IMAGE_EQUALS_TOLERANCE_PER_MIL = 70;

suite('server_png8_format', function() {

    var serverOptionsPng32 = ServerOptions;
    serverOptionsPng32.grainstore = _.clone(ServerOptions.grainstore);
    serverOptionsPng32.grainstore.mapnik_tile_format = 'png32';
    var serverPng32 = new Windshaft.Server(serverOptionsPng32);
    serverPng32.setMaxListeners(0);

    var serverOptionsPng8 = ServerOptions;
    serverOptionsPng8.grainstore = _.clone(ServerOptions.grainstore);
    serverOptionsPng8.grainstore.mapnik_tile_format = 'png8:m=h';
    var serverPng8 = new Windshaft.Server(serverOptionsPng8);
    serverPng32.setMaxListeners(0);


    var redisClient = redis.createClient(ServerOptions.redis.port);

    suiteSetup(function(done) {
        // Check that we start with an empty redis db
        redisClient.keys("*", function(err, matches) {
            if ( err ) { done(err); return; }

            assert.equal(matches.length, 0,
                    "redis keys present at setup time on port " + ServerOptions.redis.port + ":\n"
                        + matches.join("\n"));
            done();
        });

    });


    function testOutputForPng32AndPng8(desc, tile, requestParams, callback) {

        var styleQuerystring = querystring.stringify(requestParams);
        var tilePartialUrl =  _.template('<%= z %>/<%= x %>/<%= y %>.png', tile);

        var requestPayload = {
            url: '/database/windshaft_test/table/populated_places_simple_reduced/' + tilePartialUrl + '?' + styleQuerystring,
            method: 'GET',
            encoding: 'binary'
        };

        var requestHeaders = {
            status: 200,
            headers: { 'Content-Type': 'image/png' }
        };

        var bufferPng32,
            bufferPng8;

        test(desc + '; tile: ' + JSON.stringify(tile),  function(done){
            assert.response(serverPng32, requestPayload, requestHeaders, function(responsePng32) {
                assert.equal(responsePng32.headers['content-type'], "image/png");
                bufferPng32 = responsePng32.body;
                assert.response(serverPng8, requestPayload, requestHeaders, function(responsePng8) {
                    assert.equal(responsePng8.headers['content-type'], "image/png");
                    bufferPng8 = responsePng8.body;
                    assert.ok(bufferPng8.length < bufferPng32.length);
                    assert.imageBuffersAreEqual(bufferPng32, bufferPng8, IMAGE_EQUALS_TOLERANCE_PER_MIL, function(err, imagePaths, similarity) {
                        callback(err, imagePaths, similarity, done);
                    });
                });
            });
        });
    }


    var currentLevel = 3,
        allLevelTiles = [],
        maxLevelTile = Math.pow(2, currentLevel);

    for (var i = 0; i < maxLevelTile; i++) {
        for (var j = 0; j < maxLevelTile; j++) {
            allLevelTiles.push({
                z: currentLevel,
                x: i,
                y: j
            })
        }
    }


    var intensityStyle = [
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
    ].join(' ');

    var allImagePaths = [],
        similarities = [];
    allLevelTiles.forEach(function(tile) {
        testOutputForPng32AndPng8('intensity visualization', tile, {
            q: 'SELECT * FROM populated_places_simple_reduced',
            style: intensityStyle
        }, function(err, imagePaths, similarity, done) {
            allImagePaths.push(imagePaths);
            similarities.push(similarity);
            var transformPaths = [];
            for (var i = 0, len = allImagePaths.length; i < len; i++) {
                transformPaths.push({
                    passive: allImagePaths[i][0],
                    active: allImagePaths[i][1],
                    similarity: similarities[i]
                })
            }
            var output = 'handleResults(' + JSON.stringify(transformPaths) + ');';
            fs.writeFileSync('test/results/png/results.js', output);
            if (err) throw err;
            done();
        });
    });


    suiteTeardown(function(done) {
        var errors = [];

        // Check that we left the redis db empty
        redisClient.keys("*", function(err, matches) {
            if ( err ) errors.push(err);
            try {
                assert.equal(matches.length, 0, "Left over redis keys:\n" + matches.join("\n"));
            } catch (err) {
                errors.push(err);
            }

            var cachedir = global.environment.millstone.cache_basedir;
            rmdir_recursive_sync(cachedir);

            redisClient.flushall(function() {
                done(errors.length ? new Error(errors) : null);
            });
        });
    });
});

