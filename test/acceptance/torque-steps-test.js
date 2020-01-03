'use strict';

require('../support/test-helper');

const assert = require('../support/assert');
const TestClient = require('../support/test-client');

describe('torque steps', function () {
    const IMAGE_TOLERANCE_PER_MIL = 20;

    const sql = `
    WITH rows AS (
        SELECT
            row_number() over() as v,
            CASE WHEN xx%2 = 0 THEN -90 ELSE 90 END AS x,
            CASE WHEN yy%2 = 0 THEN -45 ELSE 45 END AS y
        FROM generate_series(0, 1) xx, generate_series(0, 1) yy
    )
    SELECT
        row_number() over() as cartodb_id,
        v + tdiff as t,
        v + tdiff as v,
        ST_AsText(ST_MakePoint(x, y)),
        ST_SetSRID(ST_MakePoint(x, y), 4326) as the_geom,
        ST_Transform(ST_SetSRID(ST_MakePoint(x, y), 4326), 3857) as the_geom_webmercator
    FROM rows, generate_series(0,4,4) as tdiff
    `;

    const cartocss = `
    Map {
        -torque-frame-count: 8;
        -torque-resolution: 1;
        -torque-time-attribute: "t";
        -torque-aggregation-function: "sum(v)";
    }
    #layer {
        marker-width: 20 + (5 * [value]);
        marker-fill: #F00;
    }`;

    const expectedTorqueTile = [
        {
            x__uint8: 64,
            y__uint8: 92,
            vals__uint8: [1, 5],
            dates__uint16: [0, 4]
        },
        {
            x__uint8: 64,
            y__uint8: 164,
            vals__uint8: [2, 6],
            dates__uint16: [1, 5]
        },
        {
            x__uint8: 192,
            y__uint8: 92,
            vals__uint8: [3, 7],
            dates__uint16: [2, 6]
        },
        {
            x__uint8: 192,
            y__uint8: 164,
            vals__uint8: [4, 8],
            dates__uint16: [3, 7]
        }
    ];

    var torqueMapConfig = (step = 0, orderBy = '') => {
        var tileSql = 'WITH par AS (' +
                'WITH innerpar AS (' +
                    'SELECT ' +
                        '1.0/(({xyz_resolution})*{resolution}) as resinv, ' +
                        'ST_MakeEnvelope({b_xmin}, {b_ymin}, {b_xmax}, {b_ymax}, {srid}) as b_ext, ' +
                        'ST_MakeEnvelope({xmin}, {ymin}, {xmax}, {ymax}, {srid}) as ext' +
                ') ' +
                'SELECT ' +
                    '({xyz_resolution})*{resolution} as res, ' +
                    'innerpar.resinv as resinv, ' +
                    'innerpar.b_ext as b_ext, ' +
                    'st_xmin(innerpar.ext) as xmin, ' +
                    'st_ymin(innerpar.ext) as ymin, ' +
                    'round((st_xmax(innerpar.ext) - st_xmin(innerpar.ext))*innerpar.resinv) - 1 as maxx, ' +
                    'round((st_ymax(innerpar.ext) - st_ymin(innerpar.ext))*innerpar.resinv) - 1 as maxy ' +
                'FROM innerpar' +
            ') ' +
            'SELECT xx x__uint8, ' +
                 'yy y__uint8, ' +
                 'array_agg(c) vals__uint8, ' +
                 'array_agg(d) dates__uint16 ' +
            'FROM ( ' +
            'select ' +
               'GREATEST(0 - {b_size}, LEAST(p.maxx + {b_size}, round((st_x(i.{gcol}) - p.xmin)*resinv))) as xx, ' +
               'GREATEST(0 - {b_size}, LEAST(p.maxy + {b_size}, round((st_y(i.{gcol}) - p.ymin)*resinv))) as yy ' +
               ', {countby} c ' +
               ', floor(({column_conv} - {start})/{step}) d ' +
                'FROM ({_sql}) i, par p ' +
                'WHERE i.{gcol} && p.b_ext ' +
                '{_stepFilter}' +
            'GROUP BY xx, yy, d  ' +
            ') cte, par  ' +
            'GROUP BY x__uint8, y__uint8';

        return {
            version: '1.6.0',
            layers: [
                {
                    type: 'torque',
                    options: {
                        sql,
                        cartocss,
                        cartocss_version: '1.0.0',
                        step,
                        tile_sql: tileSql + orderBy
                    }
                }
            ]
        };
    };

    function torquePngFixture (step) {
        return `./test/fixtures/torque/agg-order-step-${step}.png`;
    }

    const steps = [0, 1, 2, 3, 4, 5, 6, 7];
    steps.forEach(step => {
        it(`should sort dates and vals — step=${step}`, function (done) {
            var testClient = new TestClient(torqueMapConfig(step));
            testClient.getTile(0, 0, 0, { layer: 0, format: 'png' }, function (err, torqueTile) {
                assert.ifError(err);
                assert.imageEqualsFile(torqueTile, torquePngFixture(step), IMAGE_TOLERANCE_PER_MIL, function (err) {
                    assert.ifError(err);
                    done();
                });
            });
        });
    });

    it('should sort dates and vals torque.json', function (done) {
        var testClient = new TestClient(torqueMapConfig(undefined));
        testClient.getTile(0, 0, 0, { layer: 0, format: 'torque.json' }, function (err, torqueTile) {
            assert.ifError(err);
            assert.ok(torqueTile);
            assert.deepEqual(torqueTile, expectedTorqueTile);
            done();
        });
    });

    const orderBySteps = [
        ' ORDER BY x__uint8 ASC ',
        ' ORDER BY x__uint8 DESC ',
        ' ORDER BY y__uint8 ASC ',
        ' ORDER BY y__uint8 DESC '
    ];
    orderBySteps.forEach(orderByStep => {
        steps.forEach(step => {
            it(`should be order independent -order=${orderByStep} - step=${step}`, function (done) {
                var testClient = new TestClient(torqueMapConfig(step));
                testClient.getTile(0, 0, 0, { layer: 0, format: 'png' }, function (err, torqueTile) {
                    assert.ifError(err);
                    assert.imageEqualsFile(torqueTile, torquePngFixture(step), IMAGE_TOLERANCE_PER_MIL, function (err) {
                        assert.ifError(err);
                        done();
                    });
                });
            });
        });
    });
});
