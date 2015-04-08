require('../support/test_helper');

var fs = require('fs');

var assert = require('../support/assert');
var testClient = require('../support/test_client');
var serverOptions = require('../support/server_options');

describe('render limits', function() {

    var IMAGE_EQUALS_TOLERANCE_PER_MIL = 25;

    var limitsConfig;
    var onTileErrorStrategy;
    before(function() {
        limitsConfig = serverOptions.renderer.mapnik.limits;
        serverOptions.renderer.mapnik.limits = {
            render: 50,
            cacheOnTimeout: false
        };
        onTileErrorStrategy = serverOptions.renderer.onTileErrorStrategy;
        serverOptions.renderer.onTileErrorStrategy = function(err, tile, headers, stats, format, callback) {
            callback(err, tile, headers, stats);
        };
    });

    after(function() {
        serverOptions.renderer.mapnik.limits = limitsConfig;
        serverOptions.renderer.onTileErrorStrategy = onTileErrorStrategy;
    });

    var slowQuery = 'select pg_sleep(1), * from test_table limit 2';
    var slowQueryMapConfig = testClient.singleLayerMapConfig(slowQuery);

    it('slow query/render returns with 400 status', function(done) {
        var options = {
            statusCode: 400,
            serverOptions: serverOptions
        };
        testClient.createLayergroup(slowQueryMapConfig, options, function(err, res) {
            assert.deepEqual(JSON.parse(res.body), { errors: ["Render timed out"] });
            done();
        });
    });

    it('uses onTileErrorStrategy to handle error and modify response', function(done) {
        serverOptions.renderer.onTileErrorStrategy = function(err, tile, headers, stats, format, callback) {
            var fixture = __dirname + '/../fixtures/limits/fallback.png';
            fs.readFile(fixture, {encoding: 'binary'}, function(err, img) {
                callback(null, img, {'Content-Type': 'image/png'}, {});
            });
        };
        var options = {
            statusCode: 200,
            contentType: 'image/png',
            serverOptions: serverOptions
        };
        testClient.createLayergroup(slowQueryMapConfig, options, function(err, res) {
            var parsed = JSON.parse(res.body);
            assert.ok(parsed.layergroupid);
            done();
        });
    });

    it('returns a fallback tile that was modified via onTileErrorStrategy', function(done) {
        var fixtureImage = './test/fixtures/limits/fallback.png';
        serverOptions.renderer.onTileErrorStrategy = function(err, tile, headers, stats, format, callback) {
            fs.readFile(fixtureImage, {encoding: null}, function(err, img) {
                callback(null, img, {'Content-Type': 'image/png'}, {});
            });
        };
        var options = {
            statusCode: 200,
            contentType: 'image/png',
            serverOptions: serverOptions
        };
        testClient.withLayergroup(slowQueryMapConfig, options, function(err, requestTile, finish) {
            var tileUrl = '/0/0/0.png';
            requestTile(tileUrl, options, function(err, res) {
                assert.imageEqualsFile(res.body, fixtureImage, IMAGE_EQUALS_TOLERANCE_PER_MIL, function(err) {
                    finish(function(finishErr) {
                        done(err || finishErr);
                    });
                });
            });
        });
    });

});
