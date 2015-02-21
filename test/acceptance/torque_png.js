var assert = require('../support/assert');
var redis = require('redis');
var th = require('../support/test_helper');
var testTile = require('../support/test_tile');

suite('torque png renderer', function() {

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

    var torquePngPointsMapConfig =  {
        version: '1.2.0',
        layers: [
            {
                type: 'torque',
                options: {
                    sql: "SELECT * FROM populated_places_simple_reduced where the_geom && ST_MakeEnvelope(-90, 0, 90, 65)",
                    cartocss: [
                        'Map {',
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

    var tileRequests = [
        {
            z: 2,
            x: 2,
            y: 1,
            layer: 0,
            format: 'torque.png'
        },
        {
            z: 2,
            x: 1,
            y: 1,
            layer: 0,
            format: 'torque.png'
        }
    ];

    function torquePngFixture(zxy) {
        return './test/fixtures/torque/populated_places_simple_reduced-' + zxy.join('.') + '.png'
    }

    tileRequests.forEach(function(tileRequest) {
        var zxy = [tileRequest.z, tileRequest.x, tileRequest.y];
        test('tile ' + zxy.join('/') + '.torque.png', function (done) {
            testTile(torquePngPointsMapConfig, tileRequest, function(err, res, finish) {
                assert.imageEqualsFile(res.body, torquePngFixture(zxy), IMAGE_TOLERANCE_PER_MIL, function(err) {
                    assert.ok(!err);
                    finish(done);
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
