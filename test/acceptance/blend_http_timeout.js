'use strict';

require('../support/test_helper');

var assert = require('../support/assert');
var TestClient = require('../support/test_client');
var fs = require('fs');
var http = require('http');

describe.skip('blend http client timeout', function () {
    var mapConfig = {
        version: '1.3.0',
        layers: [
            {
                type: 'http',
                options: {
                    urlTemplate: 'http://127.0.0.1:8033/{s}/{z}/{x}/{y}.png',
                    subdomains: ['light']
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

    var httpRendererTimeout = 100;

    var slowHttpRendererResourcesServer;
    var testClient;

    before(function (done) {
        testClient = new TestClient(mapConfig, {
            http: {
                timeout: httpRendererTimeout
            }
        });

        // Start a server to test external resources
        slowHttpRendererResourcesServer = http.createServer(function (request, response) {
            setTimeout(function () {
                var filename = __dirname + '/../fixtures/http/light_nolabels-1-0-0.png';
                fs.readFile(filename, { encoding: 'binary' }, function (err, file) {
                    response.writeHead(200);
                    response.write(file, 'binary');
                    response.end();
                });
            }, httpRendererTimeout * 2);
        });
        slowHttpRendererResourcesServer.listen(8033, done);
    });

    after(function (done) {
        slowHttpRendererResourcesServer.close(done);
    });

    it('should fail to render when http layer times out', function (done) {
        testClient.getTile(0, 0, 0, { layer: 'all' }, function (err) {
            assert.ok(err);
            assert.equal(err.message, 'Unable to fetch http tile: http://127.0.0.1:8033/light/0/0/0.png');
            assert.equal(err.code, 'ETIMEDOUT');
            done();
        });
    });
});
