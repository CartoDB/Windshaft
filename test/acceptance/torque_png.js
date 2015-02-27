require('../support/test_helper');

var assert = require('../support/assert');
var redis = require('redis');
var testClient = require('../support/test_client');

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
                    sql: "SELECT * FROM populated_places_simple_reduced where the_geom" +
                        " && ST_MakeEnvelope(-90, 0, 90, 65)",
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
        return './test/fixtures/torque/populated_places_simple_reduced-' + zxy.join('.') + '.png';
    }

    tileRequests.forEach(function(tileRequest) {
        var z = tileRequest.z,
            x = tileRequest.x,
            y = tileRequest.y;
        var zxy = [z, x, y];
        test('tile ' + zxy.join('/') + '.torque.png', function (done) {
            testClient.getTileLayer(torquePngPointsMapConfig, tileRequest, function(err, res) {
                assert.imageEqualsFile(res.body, torquePngFixture(zxy), IMAGE_TOLERANCE_PER_MIL, function(err) {
                    assert.ok(!err);
                    done();
                });
            });
        });
    });


    var mapConfigTorqueOffset = {
        version: '1.3.0',
        layers: [
            {
                type: 'torque',
                options: {
                    sql: "SELECT * FROM populated_places_simple_reduced",
                    cartocss: [
                        'Map {',
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

    test('torque static map with offset', function(done) {
        var w = 600,
            h = 400;

        testClient.getStaticBbox(mapConfigTorqueOffset, -170, -87, 170, 87, w, h, function(err, res, img) {
            if (err) {
                return done(err);
            }

            assert.equal(img.width(), w);
            assert.equal(img.height(), h);

            done();
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
