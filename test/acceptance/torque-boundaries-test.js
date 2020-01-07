'use strict';

require('../support/test-helper');

var assert = require('../support/assert');
var TestClient = require('../support/test-client');

describe('torque boundary points', function () {
    var boundaryPointsMapConfig = {
        version: '1.1.0',
        layers: [
            {
                type: 'torque',
                options: {
                    sql: 'WITH p AS ( ' +
                    " SELECT '1970-01-02'::date as d, " +
                    // r1 is pixel resolution at zoom level 1
                    // s1 is tile size at zoom level 1
                    ' 1e-40 as o, 78271.517578125 as r1, 20037508.5 as s1 )' +
                    ' SELECT 1 as i, d, ST_MakePoint(0,0) as ug FROM p' +
                    ' UNION ALL ' +
                    'SELECT 2, d, ST_MakePoint(-o,-o) FROM p' +
                    ' UNION ALL ' +
                    'SELECT 3, d, ST_MakePoint(-o,o) FROM p' +
                    ' UNION ALL ' +
                    'SELECT 4, d, ST_MakePoint(o,-o) FROM p' +
                    ' UNION ALL ' +
                    'SELECT 5, d, ST_MakePoint(o,o) FROM p' +
                    ' UNION ALL ' +
                    'SELECT 6, d, ST_MakePoint(-r1,r1) FROM p' +
                    ' UNION ALL ' +
                    'SELECT 7, d, ST_MakePoint(-r1/2,r1) FROM p' +
                    ' UNION ALL ' +
                    'SELECT 8, d, ST_MakePoint(-r1,-r1) FROM p' +
                    ' UNION ALL ' +
                    // this is discarded, being on the right boundary
                    'SELECT 9, d, ST_MakePoint(s1,0) FROM p' +
                    ' UNION ALL ' +
                    // this is discarded, being on the top boundary
                    'SELECT 10, d, ST_MakePoint(0,s1) FROM p' +
                    ' UNION ALL ' +
                    // this is discarded, rounding to the right boundary
                    'SELECT 11, d, ST_MakePoint(s1-r1/2,0) FROM p' +
                    ' UNION ALL ' +
                    // this is discarded, rounding to the top boundary
                    'SELECT 12, d, ST_MakePoint(0,s1-r1/2) FROM p',
                    geom_column: 'ug',
                    cartocss: 'Map { ' +
                    '-torque-frame-count:2; ' +
                    '-torque-resolution:1; ' +
                    '-torque-time-attribute:"d"; ' +
                    '-torque-data-aggregation:linear; ' +
                    '-torque-aggregation-function:"count(i)"; }',
                    cartocss_version: '1.0.1'
                }
            }
        ]
    };

    var testClient;
    before(function () {
        testClient = new TestClient(boundaryPointsMapConfig);
    });

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
                    vals__uint8: [{ v: 2, d: 'i=6 (-r1,r1) and i=7(-r1/2,r1)' }],
                    dates__uint16: [0]
                },
                {
                    x__uint8: 255,
                    y__uint8: 1,
                    vals__uint8: [{ v: 2, d: 'i=1 and i=3' }],
                    dates__uint16: [0]
                },
                {
                    x__uint8: 255,
                    y__uint8: 255,
                    vals__uint8: [{ v: 2, d: 'i=10 and i=12' }],
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
                    vals__uint8: [{ v: 2, d: 'i=9 and i=11' }],
                    dates__uint16: [0]
                },
                {
                    x__uint8: 0,
                    y__uint8: 0,
                    vals__uint8: [{ v: 2, d: 'i=1 and i=5' }],
                    dates__uint16: [0]
                },
                {
                    x__uint8: 0,
                    y__uint8: 255,
                    vals__uint8: [{ v: 2, d: 'i=10 and i=12' }],
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
                    vals__uint8: [{ v: 3, d: 'i=1, i=2 and i=8' }],
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

    tileRequests.forEach(function (tileRequest) {
        // See https://github.com/CartoDB/Windshaft/issues/186
        var desc = 'handles ' + tileRequest.desc + '.json.torque\n\n\t' + tileRequest.repr.join('\n\t') + '\n\n';
        it(desc, function (done) {
            var z = tileRequest.z;
            var x = tileRequest.x;
            var y = tileRequest.y;

            testClient.getTile(z, x, y, { layer: 0, format: 'torque.json' }, function (err, torqueTile) {
                assert.ifError(err);
                var i = 0;
                torqueTile.sort(function (a, b) {
                    if (a.x__uint8 === b.x__uint8) {
                        return (a.y__uint8 > b.y__uint8);
                    }
                    return (a.x__uint8 < b.x__uint8);
                });
                tileRequest.expects.forEach(function (expected) {
                    assert.equal(
                        torqueTile[i].x__uint8,
                        expected.x__uint8,
                        torqueTile[i].x__uint8 + ' == ' + expected.x__uint8 +
                            '\nRESULT\n------' +
                            '\n' + JSON.stringify(torqueTile, null, 4) +
                            '\nEXPECTED\n--------' +
                            '\n' + JSON.stringify(tileRequest.expects, null, 4)
                    );
                    assert.equal(
                        torqueTile[i].y__uint8,
                        expected.y__uint8,
                        torqueTile[i].y__uint8 + ' == ' + expected.y__uint8 +
                            '\nRESULT\n------' +
                            '\n' + JSON.stringify(torqueTile, null, 4) +
                            '\nEXPECTED\n--------' +
                            '\n' + JSON.stringify(tileRequest.expects, null, 4)
                    );
                    var j = 0;
                    expected.vals__uint8.forEach(function (val) {
                        assert.equal(
                            torqueTile[i].vals__uint8[j],
                            val.v,
                            'desc: ' + val.d +
                                'Number of points got=' + torqueTile.length + '; ' +
                                'expected=' + tileRequest.expects.length +
                                '\n\tindex=' + i +
                                '\n\tvals__uint8 index=' + j +
                                '\n\tgot=' + torqueTile[i].vals__uint8[j] +
                                '\n\texpected=' + val.v +
                                '\nRESULT\n------' +
                                '\n' + JSON.stringify(torqueTile, null, 4) +
                                '\nEXPECTED\n--------' +
                                '\n' + JSON.stringify(tileRequest.expects, null, 4));

                        j++;
                    });

                    i++;
                });

                assert.equal(
                    torqueTile.length,
                    tileRequest.expects.length,
                    'Number of points did not match ' +
                        'got=' + torqueTile.length + '; ' +
                        'expected=' + tileRequest.expects.length +
                        '\nRESULT\n------' +
                        '\n' + JSON.stringify(torqueTile, null, 4) +
                        '\nEXPECTED\n--------' +
                        '\n' + JSON.stringify(tileRequest.expects, null, 4));

                done();
            });
        });
    });
});
