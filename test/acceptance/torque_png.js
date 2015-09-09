require('../support/test_helper');

var assert = require('../support/assert');
var TestClient = require('../support/test_client');
var OldTestClient = require('../support/test_client_old');

describe('torque png renderer', function() {

    describe('tiles', function() {

        var IMAGE_TOLERANCE_PER_MIL = 20;

        var torquePngPointsMapConfig =  {
            version: '1.2.0',
            layers: [
                {
                    type: 'torque',
                    options: {
                        sql: "SELECT * FROM populated_places_simple_reduced where the_geom" +
                            " && ST_MakeEnvelope(-90, 0, 90, 65)",
                        cartocss: [
                            'Map {',
                            '    buffer-size:0;',
                            '    -torque-frame-count:1;',
                            '    -torque-animation-duration:30;',
                            '    -torque-time-attribute:"cartodb_id";',
                            '    -torque-aggregation-function:"count(cartodb_id)";',
                            '    -torque-resolution:1;',
                            '    -torque-data-aggregation:linear;',
                            '}',
                            '#populated_places_simple_reduced{',
                            '    comp-op: multiply;',
                            '    marker-fill-opacity: 1;',
                            '    marker-line-color: #FFF;',
                            '    marker-line-width: 0;',
                            '    marker-line-opacity: 1;',
                            '    marker-type: rectangle;',
                            '    marker-width: 3;',
                            '    marker-fill: #FFCC00;',
                            '}'
                        ].join(' '),
                        cartocss_version: '2.3.0'
                    }
                }
            ]
        };

        var testClient;
        before(function() {
            testClient = new TestClient(torquePngPointsMapConfig);
        });

        var tileRequests = [
            {
                z: 2,
                x: 2,
                y: 1
            },
            {
                z: 2,
                x: 1,
                y: 1
            }
        ];

        function torquePngFixture(zxy) {
            return './test/fixtures/torque/populated_places_simple_reduced-' + zxy.join('.') + '.png';
        }

        tileRequests.forEach(function(tileRequest) {
            var z = tileRequest.z,
                x = tileRequest.x,
                y = tileRequest.y;
            var zxy = [z, x, y];
            it('torque png tile ' + zxy.join('/') + '.png', function (done) {
                testClient.getTile(z, x, y, {layer: 0}, function(err, tile) {
                    assert.imageEqualsFile(tile, torquePngFixture(zxy), IMAGE_TOLERANCE_PER_MIL, function(err) {
                        assert.ok(!err);
                        done();
                    });
                });
            });
        });
    });

    describe('static map', function() {
        var mapConfigTorqueOffset = {
            version: '1.3.0',
            layers: [
                {
                    type: 'torque',
                    options: {
                        sql: "SELECT * FROM populated_places_simple_reduced",
                        cartocss: [
                            'Map {',
                            'buffer-size:0;',
                            '-torque-frame-count:1;',
                            '-torque-animation-duration:30;',
                            '-torque-time-attribute:"cartodb_id";',
                            '-torque-aggregation-function:"count(cartodb_id)";',
                            '-torque-resolution:2;',
                            '-torque-data-aggregation:linear;',
                            '}',
                            '',
                            '#populated_places_simple_reduced{',
                            '  comp-op: lighter;',
                            '  marker-fill-opacity: 0.9;',
                            '  marker-line-color: #2167AB;',
                            '  marker-line-width: 5;',
                            '  marker-line-opacity: 1;',
                            '  marker-type: ellipse;',
                            '  marker-width: 6;',
                            '  marker-fill: #FF9900;',
                            '}',
                            '#populated_places_simple_reduced[frame-offset=1] {',
                            ' marker-width:8;',
                            ' marker-fill-opacity:0.45; ',
                            '}',
                            '#populated_places_simple_reduced[frame-offset=2] {',
                            ' marker-width:10;',
                            ' marker-fill-opacity:0.225; ',
                            '}'
                        ].join(' '),
                        cartocss_version: '2.3.0'
                    }
                }
            ]
        };

        it('torque static map with offset', function(done) {
            var w = 600,
                h = 400;

            OldTestClient.getStaticBbox(mapConfigTorqueOffset, -170, -87, 170, 87, w, h, function(err, res, img) {
                if (err) {
                    return done(err);
                }

                assert.equal(img.width(), w);
                assert.equal(img.height(), h);

                done();
            });

        });
    });

});
