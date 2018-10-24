'use strict';

require('../support/test_helper');

const fs = require('fs');
const zlib = require('zlib');
const http = require('http');
const assert = require('../support/assert');
const TestClient = require('../support/test_client');
const IMAGE_TOLERANCE_PER_MIL = 20;
const fixtureFile = './test/fixtures/torque/populated_places_simple_reduced-marker-file-2.2.1.png';
const fixtureFileCairo = './test/fixtures/torque/populated_places_simple_reduced-marker-file-2.2.1-cairo-lt-1.14.png';

describe('torque png renderer', function() {
    describe('tiles witn marker-file pointing to a server', function() {
        before(function (done) {
            this.resourcesServer = http.createServer((request, response) => {
                const fileStream = fs.createReadStream(__dirname + '/../fixtures/markers' + request.url);
                response.writeHead(200, { 'content-encoding': 'gzip' });
                fileStream.pipe(zlib.createGzip()).pipe(response);
            });

            this.resourcesServer.listen(0, (err) => {
                if (err) {
                    return done(err);
                }

                this.port = this.resourcesServer.address().port;
                this.markerFileUrl = `http://localhost:${this.port}/maki/circle-24.png`;

                done();
            });

        });

        after(function(done) {
            this.resourcesServer.close(done);
        });

        it('should support marker-file with url with a gziped image', function(done) {
            const mapConfig = {
                version: '1.3.0',
                layers: [
                    {
                        type: 'torque',
                        options: {
                            sql: 'select * from populated_places_simple_reduced',
                            cartocss: [
                                'Map {',
                                    '-torque-frame-count:1;',
                                    '\n-torque-animation-duration:30;',
                                    '\n-torque-time-attribute:\"cartodb_id\";',
                                    '\n-torque-aggregation-function:\"count(cartodb_id)\";',
                                    '\n-torque-resolution:1;',
                                    '\n-torque-data-aggregation:linear;',
                                '}',
                                '',
                                '#protected_areas_points{',
                                    'marker-width: 4;',
                                    'marker-file: url(' + this.markerFileUrl + ');',
                                '}'
                            ].join('\n')
                        }
                    }
                ]
            };

            this.testClient = new TestClient(mapConfig);

            this.testClient.getTile(2, 2, 1, (err, tile) => {
                if (err) {
                    return done(err);
                }

                assert.imageEqualsFile(tile, fixtureFileCairo, IMAGE_TOLERANCE_PER_MIL, (err) => {
                    if (err) {
                        return assert.imageEqualsFile(tile, fixtureFile, IMAGE_TOLERANCE_PER_MIL, (err) => {
                            assert.ifError(err);
                            done();
                        });
                    }

                    done(new Error(`Tile equal to ${fixtureFileCairo}`));
                });
            });
        });
    });
});
