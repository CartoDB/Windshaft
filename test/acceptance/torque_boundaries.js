var   assert        = require('../support/assert')
    , redis         = require('redis')
    , th            = require('../support/test_helper')
    , Windshaft     = require('../../lib/windshaft')
    , ServerOptions = require('../support/server_options');

suite('boundary points', function() {

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
            repr: [
                ' ------',
                '|      |',
                '|      |',
                ' ------'
            ],
            z: 0,
            x: 0,
            y: 0,
            expects: [
                {
                    x__uint8: 255,
                    y__uint8: 128,
                    vals__uint8: [{
                        v: 2,
                        d: 'i=9 and i=11'
                    }],
                    dates__uint16: [0]
                },
                {
                    x__uint8: 128,
                    y__uint8: 128,
                    vals__uint8: [{
                        v: 8,
                        d: 'i=[1..8]'
                    }],
                    dates__uint16: [0]
                },
                {
                    x__uint8: 128,
                    y__uint8: 255,
                    vals__uint8: [{
                        v: 2,
                        d: 'i=10 and i=12'
                    }],
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
                    y__uint8: 0,
                    vals__uint8: [{v: 2, d: 'i=6 (-r1,r1) and i=7(-r1/2,r1)'}],
                    dates__uint16: [0]
                },
                {
                    x__uint8: 255,
                    y__uint8: 1,
                    vals__uint8: [{v: 2, d: 'i=1 and i=3'}],
                    dates__uint16: [0]
                },
                {
                    x__uint8: 255,
                    y__uint8: 255,
                    vals__uint8: [{v: 2, d: 'i=10 and i=12'}],
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
                    x__uint8: 255,
                    y__uint8: 0,
                    vals__uint8: [{v: 2, d: 'i=9 and i=11'}],
                    dates__uint16: [0]
                },
                {
                    x__uint8: 0,
                    y__uint8: 0,
                    vals__uint8: [{v: 2, d: 'i=1 and i=5'}],
                    dates__uint16: [0]
                },
                {
                    x__uint8: 0,
                    y__uint8: 255,
                    vals__uint8: [{v: 2, d: 'i=10 and i=12'}],
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
                    vals__uint8: [{v: 3, d: 'i=1, i=2 and i=8'}],
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
            expects: [
                {
                    x__uint8: 255,
                    y__uint8: 255,
                    vals__uint8: [{
                        v: 2,
                        d: 'i=9 and i=11'
                    }],
                    dates__uint16: [0]
                },
                {
                    x__uint8: 0,
                    y__uint8: 255,
                    vals__uint8: [{
                        v: 2,
                        d: 'i=1 and i=4'
                    }],
                    dates__uint16: [0]
                }
            ]
        }
    ];

    tileRequests.forEach(function(tileRequest) {
        // See https://github.com/CartoDB/Windshaft/issues/186
        test('handles ' + tileRequest.desc + '.json.torque\n\n\t' + tileRequest.repr.join('\n\t') + '\n\n', function (done) {

            assert.response(server, {
                url: '/database/windshaft_test/layergroup',
                method: 'POST',
                headers: {'Content-Type': 'application/json' },
                data: JSON.stringify(boundaryPointsMapConfig)
            }, {}, function (res, err) {

                assert.ok(!err, 'Failed to create layergroup');

                var parsedBody = JSON.parse(res.body);
                var expected_token = parsedBody.layergroupid;
                layergroupIdToDelete = expected_token;

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
                        assert.equal(
                            parsed[i].x__uint8,
                            expected.x__uint8,
                            parsed[i].x__uint8 + ' == ' + expected.x__uint8 +
                                '\nRESULT\n------' +
                                '\n' + JSON.stringify(parsed, null, 4) +
                                '\nEXPECTED\n--------' +
                                '\n' + JSON.stringify(tileRequest.expects, null, 4)
                        );
                        assert.equal(
                            parsed[i].y__uint8,
                            expected.y__uint8,
                            parsed[i].y__uint8 + ' == ' + expected.y__uint8 +
                                '\nRESULT\n------' +
                                '\n' + JSON.stringify(parsed, null, 4) +
                                '\nEXPECTED\n--------' +
                                '\n' + JSON.stringify(tileRequest.expects, null, 4)
                        );

                        var j = 0;
                        expected.vals__uint8.forEach(function(val) {
                            assert.equal(
                                parsed[i].vals__uint8[j],
                                val.v,
                                'desc: ' + val.d +
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
                            'expected=' + tileRequest.expects.length +
                            '\nRESULT\n------' +
                            '\n' + JSON.stringify(parsed, null, 4) +
                            '\nEXPECTED\n--------' +
                            '\n' + JSON.stringify(tileRequest.expects, null, 4));

                    done();
                });
            });
        });
    });

    test('regression london point', function(done) {
        var londonPointMapConfig =  {
            version: '1.1.0',
            layers: [
                { type: 'torque', options: {
                    sql: "SELECT " +
                            "1 as i, " +
                            "'1970-01-02'::date as d, " +
                            "ST_MakePoint(-11309.9155492599,6715342.44989312) g",
                    geom_column: 'g',
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

        assert.response(server, {
            url: '/database/windshaft_test/layergroup',
            method: 'POST',
            headers: {'Content-Type': 'application/json' },
            data: JSON.stringify(londonPointMapConfig)
        }, {}, function (res, err) {
            assert.ok(!err, 'Failed to create layergroup');

            var parsedBody = JSON.parse(res.body);
            var layergroupId = parsedBody.layergroupid;
            layergroupIdToDelete = layergroupId;


            assert.response(server, {
                url: '/database/windshaft_test/layergroup/' + layergroupId + '/0/2/1/1.json.torque',
                method: 'GET'
            }, {}, function (res, err) {
                assert.ok(!err, 'Failed to request torque.json');

                var parsed = JSON.parse(res.body);

                assert.deepEqual(parsed, [{
                    x__uint8: 255,
                    y__uint8: 172,
                    vals__uint8: [1],
                    dates__uint16: [0]
                }]);

                done();
            });
        });
    });

    test('should consider resolution for least value in query', function(done) {
        var londonPointMapConfig =  {
            version: '1.1.0',
            layers: [
                { type: 'torque', options: {
                    sql: "" +
                    "SELECT " +
                        "0 as i, " +
                        "st_transform('0101000020E6100000FABD3AB4B5031C400581A80ECC2F4940'::geometry, 3857) as g " +
                    "UNION ALL " +
                    "SELECT " +
                        "2 as i, " +
                        "st_transform('0101000020E61000006739E30EAE031C406625C0C3C72F4940'::geometry, 3857) as g " +
                    "UNION ALL " +
                    "SELECT " +
                        "3 as i, " +
                        "st_transform('0101000020E6100000E26DB8A2A7031C40C8BAA5C2C52F4940'::geometry, 3857) as g",
                    geom_column: 'g',
                    cartocss: 'Map { ' +
                        '-torque-frame-count:1; ' +
                        '-torque-animation-duration:30;' +
                        '-torque-time-attribute:"i"; ' +
                        '-torque-aggregation-function:"count(i)"; ' +
                        '-torque-resolution:2; ' +
                        '-torque-data-aggregation: cumulative; }',
                    cartocss_version: '1.0.1'
                } }
            ]
        };

        assert.response(server, {
            url: '/database/windshaft_test/layergroup',
            method: 'POST',
            headers: {'Content-Type': 'application/json' },
            data: JSON.stringify(londonPointMapConfig)
        }, {}, function (res, err) {
            assert.ok(!err, 'Failed to create layergroup');

            var parsedBody = JSON.parse(res.body);
            var layergroupId = parsedBody.layergroupid;
            layergroupIdToDelete = layergroupId;


            assert.response(server, {
                url: '/database/windshaft_test/layergroup/' + layergroupId + '/0/13/4255/2765.json.torque',
                method: 'GET'
            }, {}, function (res, err) {
                assert.ok(!err, 'Failed to request torque.json');

                var parsed = JSON.parse(res.body);

                assert.deepEqual(parsed, [
                    {
                        x__uint8: 47,
                        y__uint8: 127,
                        vals__uint8: [2],
                        dates__uint16: [0]
                    },
                    {
                        x__uint8: 48,
                        y__uint8: 127,
                        vals__uint8: [1],
                        dates__uint16: [0]
                    }
                ]);

                done();
            });
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
