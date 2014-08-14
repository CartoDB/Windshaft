var   assert        = require('../support/assert')
    , redis         = require('redis')
    , th            = require('../support/test_helper')
    , Windshaft     = require('../../lib/windshaft')
    , ServerOptions = require('../support/server_options');

suite('boundary points', function() {

    suiteSetup(function(done) {
        // Check that we start with an empty redis db
        redis_client.keys("*", function(err, matches) {
            if ( err ) { done(err); return; }
            assert.equal(matches.length, 0, "redis keys present at setup time:\n" + matches.join("\n"));
            done();
        });
    });

    var server = new Windshaft.Server(ServerOptions);
    server.setMaxListeners(0);
    var redis_client = redis.createClient(ServerOptions.redis.port);

    var boundaryPointsMapConfig =  {
        version: '1.1.0',
        layers: [
            { type: 'torque', options: {
                sql: "WITH p AS ( " +
                    " SELECT '1970-01-02'::date as d, " +
                    // r1 is pixel resolution at zoom level 1
                    // s1 is tile size at zoom level 1
                    " 1e-40 as o, 78271.517578125 as r1, 20037508.5 as s1 )" +
                    " SELECT 1 as i, d, ST_MakePoint(0,0) as ug FROM p" +
                    " UNION ALL " +
                    "SELECT 2, d, ST_MakePoint(-o,-o) FROM p" +
                    " UNION ALL " +
                    "SELECT 3, d, ST_MakePoint(-o,o) FROM p" +
                    " UNION ALL " +
                    "SELECT 4, d, ST_MakePoint(o,-o) FROM p" +
                    " UNION ALL " +
                    "SELECT 5, d, ST_MakePoint(o,o) FROM p" +
                    " UNION ALL " +
                    "SELECT 6, d, ST_MakePoint(-r1,r1) FROM p" +
                    " UNION ALL " +
                    "SELECT 7, d, ST_MakePoint(-r1/2,r1) FROM p" +
                    " UNION ALL " +
                    "SELECT 8, d, ST_MakePoint(-r1,-r1) FROM p" +
                    " UNION ALL " +
                    // this is discarded, being on the right boundary
                    "SELECT 9, d, ST_MakePoint(s1,0) FROM p" +
                    " UNION ALL " +
                    // this is discarded, being on the top boundary
                    "SELECT 10, d, ST_MakePoint(0,s1) FROM p" +
                    " UNION ALL " +
                    // this is discarded, rounding to the right boundary
                    "SELECT 11, d, ST_MakePoint(s1-r1/2,0) FROM p" +
                    " UNION ALL " +
                    // this is discarded, rounding to the top boundary
                    "SELECT 12, d, ST_MakePoint(0,s1-r1/2) FROM p",
                geom_column: 'ug',
                cartocss: 'Map { ' +
                    '-torque-frame-count:2; ' +
                    '-torque-resolution:1; ' +
                    '-torque-time-attribute:"d"; ' +
                    '-torque-data-aggregation:linear; ' +
                    '-torque-aggregation-function:"count(i)"; }',
                cartocss_version: '1.0.1'
            } }
        ]
    };

    var tileRequests = [
        {
            desc: '0/0/0',
            repr: [],
            z: 0,
            x: 0,
            y: 0,
            expects: [
                {
                    x__uint8: 128,
                    y__uint8: 128,
                    vals__uint8: [{v: 8, d: 'all records in this pixel'}],
                    dates__uint16: [0]
                }
            ]
        },
        {
            desc: '1/0/0',
            repr: [
                '*00 |  10',
                '----+----',
                '01  |  11'
            ],
            z: 1,
            x: 0,
            y: 0,
            expects: [
                {
                    x__uint8: 255,
                    y__uint8: 1,
                    vals__uint8: [{v: 1, d: '-r1,r1'}],
                    dates__uint16: [0]
                }
            ]
        },
        {
            desc: '1/1/0',
            repr: [
                '00  | 10*',
                '----+----',
                '01  |  11'
            ],
            z: 1,
            x: 1,
            y: 0,
            expects: [
                {
                    x__uint8: 0,
                    y__uint8: 0,
                    vals__uint8: [{v: 5, d: 'Records around the origin are in this pixel'}],
                    dates__uint16: [0]
                },
                {
                    x__uint8: 0,
                    y__uint8: 1,
                    vals__uint8: [{v: 1, d: '-r1/2,r1 is here'}],
                    dates__uint16: [0]
                }
            ]
        },
        {
            desc: '1/0/1',
            repr: [
                '00  |  10',
                '----+----',
                '*01 |  11'
            ],
            z: 1,
            x: 0,
            y: 1,
            expects: [
                {
                    x__uint8: 255,
                    y__uint8: 255,
                    vals__uint8: [{v: 1, d: '-r1,-r1 is here'}],
                    dates__uint16: [0]
                }
            ]
        },
        {
            desc: '1/1/1',
            repr: [
                '00  |  10',
                '----+----',
                '01  | 11*'
            ],
            z: 1,
            x: 1,
            y: 1,
            expects: []
        }
    ];

    tileRequests.forEach(function(tileRequest) {
        // See https://github.com/CartoDB/Windshaft/issues/186
        test('\n\n\t' + tileRequest.repr.join('\n\t') + '\n\n\thandles ' + tileRequest.desc + '.json.torque', function (done) {
            var errors = [];

            assert.response(server, {
                url: '/database/windshaft_test/layergroup',
                method: 'POST',
                headers: {'Content-Type': 'application/json' },
                data: JSON.stringify(boundaryPointsMapConfig)
            }, {}, function (res, err) {

                assert.ok(!err, 'Failed to create layergroup');

                var parsedBody = JSON.parse(res.body);
                var expected_token = parsedBody.layergroupid;

                var partialUrl = tileRequest.z + '/' + tileRequest.x + '/' + tileRequest.y;
                assert.response(server, {
                    url: '/database/windshaft_test/layergroup/' + expected_token + '/0/' + partialUrl + '.json.torque',
                    method: 'GET'
                }, {}, function (res, err) {
                    assert.ok(!err, 'Failed to get json');

                    assert.equal(res.statusCode, 200, res.body);
                    assert.equal(res.headers['content-type'], "application/json; charset=utf-8");
                    var parsed = JSON.parse(res.body);

                    var i = 0;
                    tileRequest.expects.forEach(function(expected) {
                        assert.equal(parsed[i].x__uint8, expected.x__uint8);
                        assert.equal(parsed[i].y__uint8, expected.y__uint8);

                        var j = 0;
                        expected.vals__uint8.forEach(function(val) {
                            assert.equal(
                                parsed[i].vals__uint8[j],
                                val.v,
                                'desc: ' + val.d + ' number of points. ' +
                                'Number of points got=' + parsed.length + '; ' +
                                'expected=' + tileRequest.expects.length +
                                    '\n\tindex=' + i +
                                    '\n\tvals__uint8 index=' + j +
                                    '\n\tgot=' + parsed[i].vals__uint8[j] +
                                    '\n\texpected=' + val.v +
                                    '\nRESULT\n------' +
                                    '\n' + JSON.stringify(parsed, null, 4) +
                                    '\nEXPECTED\n--------' +
                                    '\n' + JSON.stringify(tileRequest.expects, null, 4));

                            j++;
                        });

                        i++;
                    });

                    assert.equal(
                        parsed.length,
                        tileRequest.expects.length,
                        'Number of points did not match ' +
                            'got=' + parsed.length + '; ' +
                            'expected=' + tileRequest.expects.length);

                    // clear redis keys
                    redis_client.exists("map_cfg|" + expected_token, function (err, exists) {
                        if (err) errors.push(err.message);
                        assert.ok(exists, "Missing expected token " + expected_token + " from redis");
                        redis_client.del("map_cfg|" + expected_token, function (err) {
                            if (err) {
                                errors.push(err.message);
                            }

                            if (errors.length) {
                                done(new Error(errors));
                            } else {
                                done(null);
                            }
                        });
                    });
                });
            });
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
