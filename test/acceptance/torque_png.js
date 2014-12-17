var   assert        = require('../support/assert')
    , redis         = require('redis')
    , th            = require('../support/test_helper')
    , Windshaft     = require('../../lib/windshaft')
    , ServerOptions = require('../support/server_options');

suite('torque png renderer', function() {

    var IMAGE_EQUALS_TOLERANCE_PER_MIL = 20;

    var layergroupIdToDelete = null;

    suiteSetup(function(done) {
        // Check that we start with an empty redis db
        redis_client.keys("*", function(err, matches) {
            if ( err ) { done(err); return; }
            assert.equal(matches.length, 0, "redis keys present at setup time:\n" + matches.join("\n"));
            done();
        });
    });

    beforeEach(function() {
        layergroupIdToDelete = null;
    });

    var server = new Windshaft.Server(ServerOptions);
    server.setMaxListeners(0);
    var redis_client = redis.createClient(ServerOptions.redis.port);

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
            y: 1
        },
        {
            z: 2,
            x: 1,
            y: 1
        }
    ];

    tileRequests.forEach(function(tileRequest) {
        var zxy = [tileRequest.z, tileRequest.x, tileRequest.y];
        // See https://github.com/CartoDB/Windshaft/issues/186
        test('tile ' + zxy.join('/') + '.png', function (done) {

            assert.response(server,
                {
                    url: '/database/windshaft_test/layergroup',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    data: JSON.stringify(torquePngPointsMapConfig)
                },
                {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8'
                    }
                },
                function (res, err) {

                    assert.ok(!err, 'Failed to create layergroup');

                    var parsedBody = JSON.parse(res.body);
                    var layergroupid = parsedBody.layergroupid;
                    layergroupIdToDelete = layergroupid;

                    var partialUrl = zxy.join('/');

                    assert.response(server,
                        {
                            url: '/database/windshaft_test/layergroup/' + layergroupid + '/0/' + partialUrl + '.torque.png',
                            method: 'GET',

                            encoding: 'binary'
                        },
                        {
                            status: 200,
                            headers: {
                                'Content-Type': 'image/png'
                            }
                        },
                        function (res, err) {
                            assert.ok(!err, 'Failed to get torque png tile');
                            assert.imageEqualsFile(res.body, './test/fixtures/torque/populated_places_simple_reduced-' + zxy.join('.') + '.png', IMAGE_EQUALS_TOLERANCE_PER_MIL, function(err) {
                                assert.ok(!err);
                                done();
                            });
                        }
                    );
                }
            );
        });
    });

    afterEach(function(done) {
        var redisKey = 'map_cfg|' + layergroupIdToDelete;
        redis_client.del(redisKey, function () {
            done();
        });
    });

    suiteTeardown(function(done) {
        // Check that we left the redis db empty
        redis_client.keys("*", function(err, matches) {
            try {
                assert.equal(matches.length, 0, "Left over redis keys:\n" + matches.join("\n"));
            } catch (err2) {
                if ( err ) err.message += '\n' + err2.message;
                else err = err2;
            }
            redis_client.flushall(function() {
                done(err);
            });
        });
    });
});
