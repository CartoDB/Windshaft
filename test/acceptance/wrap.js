require('../support/test_helper');

var assert = require('../support/assert');
var OldTestClient = require('../support/test_client_old');
var TestClient = require('../support/test_client');

describe('wrap x coordinate', function() {

    describe('renders correct tile', function() {
        var IMG_TOLERANCE_PER_MIL = 20;

        function plainTorqueMapConfig(plainColor) {
            return {
                version: '1.2.0',
                layers: [
                    {
                        type: 'plain',
                        options: {
                            color: plainColor
                        }
                    },
                    {
                        type: 'torque',
                        options: {
                            sql: "SELECT * FROM populated_places_simple_reduced " +
                                "where the_geom && ST_MakeEnvelope(-90, 0, 90, 65)",
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
        }

        var testScenarios = [
            {
                tile: {
                    z: 2,
                    x: -2,
                    y: 1,
                    layer: 'all',
                    format: 'png'
                },
                fixture: {
                    z: 2,
                    x: 2,
                    y: 1
                },
                plainColor: 'white'
            },
            {
                tile: {
                    z: 2,
                    x: -3,
                    y: 1,
                    layer: 'all',
                    format: 'png'
                },
                fixture: {
                    z: 2,
                    x: 1,
                    y: 1
                },
                plainColor: '#339900'
            }
        ];

        function blendPngFixture(zxy) {
            return './test/fixtures/blend/blend-plain-torque-' + zxy.join('.') + '.png';
        }

        testScenarios.forEach(function(testScenario) {
            var tileRequest = testScenario.tile;
            var zxy = [tileRequest.z, tileRequest.x, tileRequest.y];
            var fixtureZxy = [testScenario.fixture.z, testScenario.fixture.x, testScenario.fixture.y];
            it('tile all/' + zxy.join('/') + '.png', function (done) {
                OldTestClient.getTileLayer(plainTorqueMapConfig(testScenario.plainColor), tileRequest, function(err, res) {
                    assert.imageEqualsFile(res.body, blendPngFixture(fixtureZxy), IMG_TOLERANCE_PER_MIL, function(err) {
                        assert.ok(!err);
                        done();
                    });
                });
            });
        });
    });

    describe('mapnik', function() {
        it("can get a tile with negative x coordinate",  function(done){
            var testClient = new TestClient(OldTestClient.defaultTableMapConfig('test_table'));
            testClient.getTile(2, -2, 1, function(err, res, img) {
                assert.ok(!err);
                assert.ok(img);
                assert.equal(img.width(), 256);
                assert.equal(img.height(), 256);
                done();
            });
        });
    });

});
