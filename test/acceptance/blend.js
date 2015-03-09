require('../support/test_helper');
var assert = require('../support/assert');
var redis = require('redis');
var testClient = require('../support/test_client');

suite('blend png renderer', function() {

    var IMAGE_TOLERANCE_PER_MIL = 20;

    var redisClient = redis.createClient(global.environment.redis.port);

    suiteSetup(function(done) {
        // Check that we start with an empty redis db
        redisClient.keys("*", function(err, matches) {
            if (err) {
                return done(err);
            }
            assert.equal(matches.length, 0, "redis keys present at setup time:\n" + matches.join("\n"));
            done();
        });
    });

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
                x: 2,
                y: 1,
                layer: 'all',
                format: 'png'
            },
            plainColor: 'white'
        },
        {
            tile: {
                z: 2,
                x: 1,
                y: 1,
                layer: 'all',
                format: 'png'
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
        test('tile all/' + zxy.join('/') + '.png', function (done) {
            testClient.getTileLayer(plainTorqueMapConfig(testScenario.plainColor), tileRequest, function(err, res) {
                assert.imageEqualsFile(res.body, blendPngFixture(zxy), IMAGE_TOLERANCE_PER_MIL, function(err) {
                    assert.ok(!err);
                    done();
                });
            });
        });
    });

    suiteTeardown(function(done) {
        // Check that we left the redis db empty
        redisClient.keys("*", function(err, matches) {
            try {
                assert.equal(matches.length, 0, "Left over redis keys:\n" + matches.join("\n"));
            } catch (err2) {
                if (err) {
                    err.message += '\n' + err2.message;
                } else {
                    err = err2;
                }
            }
            redisClient.flushall(function() {
                return done(err);
            });
        });
    });
});
