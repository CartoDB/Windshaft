'use strict';

require('../support/test-helper');

var fs = require('fs');
var http = require('http');

var redis = require('redis');

var assert = require('../support/assert');
var TestClient = require('../support/test-client');
const path = require('path');
const config = require('../support/config');

function rmdirRecursiveSync (dirname) {
    if (!fs.existsSync(dirname)) {
        return;
    }
    var files = fs.readdirSync(dirname);
    for (var i = 0; i < files.length; ++i) {
        var f = dirname + '/' + files[i];
        var s = fs.lstatSync(f);
        if (s.isFile()) {
            fs.unlinkSync(f);
        } else {
            rmdirRecursiveSync(f);
        }
    }
}

describe('external resources', function () {
    var resourcesServer;
    var resourcesServerPort = 8033;
    var numRequests;

    var redisClient = redis.createClient(config.redis.port);

    var IMAGE_EQUALS_TOLERANCE_PER_MIL = 25;

    beforeEach(function (done) {
        rmdirRecursiveSync(config.millstone.cache_basedir);
        numRequests = 0;

        // Start a server to test external resources
        resourcesServer = http.createServer(function (request, response) {
            numRequests++;
            var filename = path.join(__dirname, '/../fixtures/markers' + request.url);
            fs.readFile(filename, 'binary', function (err, file) {
                if (err) {
                    response.writeHead(404, { 'Content-Type': 'text/plain' });
                    response.write('404 Not Found\n');
                } else {
                    response.writeHead(200);
                    response.write(file, 'binary');
                }
                response.end();
            });
        });
        resourcesServer.listen(resourcesServerPort, done);
    });

    afterEach(function (done) {
        // Close the resources server
        resourcesServer.close(done);
    });

    function imageCompareFn (fixture, done) {
        return function (err, tile) {
            if (err) {
                return done(err);
            }
            assert.imageEqualsFile(tile, './test/fixtures/' + fixture, IMAGE_EQUALS_TOLERANCE_PER_MIL, done);
        };
    }

    it('basic external resource', function (done) {
        var circleStyle = "#test_table_3 { marker-file: url('http://localhost:" + resourcesServerPort +
            "/circle.svg'); marker-transform:'scale(0.2)'; }";
        var testClient = new TestClient(TestClient.defaultTableMapConfig('test_table_3', circleStyle));
        testClient.getTile(13, 4011, 3088, imageCompareFn('test_table_13_4011_3088_svg1.png', done));
    });

    it('different external resource', function (done) {
        var squareStyle = "#test_table_3 { marker-file: url('http://localhost:" + resourcesServerPort +
            "/square.svg'); marker-transform:'scale(0.2)'; }";

        var testClient = new TestClient(TestClient.defaultTableMapConfig('test_table_3', squareStyle));
        testClient.getTile(13, 4011, 3088, imageCompareFn('test_table_13_4011_3088_svg2.png', done));
    });

    // See http://github.com/CartoDB/Windshaft/issues/107
    it('external resources get localized on renderer creation if not locally cached', function (done) {
        var externalResourceStyle = "#test_table_3{marker-file: url('http://localhost:" + resourcesServerPort +
          "/square.svg'); marker-transform:'scale(0.2)'; }";

        var externalResourceMapConfig = TestClient.defaultTableMapConfig('test_table_3', externalResourceStyle);

        assert.equal(numRequests, 0);
        var externalResourceRequestsCount = numRequests;

        new TestClient(externalResourceMapConfig).createLayergroup(function () {
            assert.equal(numRequests, ++externalResourceRequestsCount);

            new TestClient(externalResourceMapConfig).createLayergroup(function (err, layergroup) {
                assert.ifError(err);
                assert.equal(numRequests, externalResourceRequestsCount);

                redisClient.del('map_cfg|' + layergroup.layergroupid, function () {
                    // reset resources cache
                    rmdirRecursiveSync(config.millstone.cache_basedir);

                    new TestClient(externalResourceMapConfig).createLayergroup(function () {
                        assert.equal(numRequests, ++externalResourceRequestsCount);

                        done();
                    });
                });
            });
        });
    });

    it('referencing unexistant external resources returns an error', function (done) {
        var url = 'http://localhost:' + resourcesServerPort + '/notfound.png';
        var style = "#test_table_3{marker-file: url('" + url + "'); marker-transform:'scale(0.2)'; }";

        var mapConfig = TestClient.defaultTableMapConfig('test_table_3', style);
        var testClient = new TestClient(mapConfig);

        testClient.createLayergroup(function (err) {
            assert.ok(err);
            assert.equal(err.message, "Unable to download '" + url + "' for 'style0' (server returned 404)");
            done();
        });
    });
});
