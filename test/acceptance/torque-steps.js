require('../support/test_helper');

const assert = require('../support/assert');
const TestClient = require('../support/test_client');

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
        marker-width: 5 * [value];
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

    var torqueMapConfig = (step = 0) => {
        return {
            version: '1.6.0',
            layers: [
                {
                    type: 'torque',
                    options: {
                        sql,
                        cartocss,
                        cartocss_version: '1.0.0',
                        step
                    }
                }
            ]
        };
    };

    function torquePngFixture(step) {
        return `./test/fixtures/torque/agg-order-step-${step}.png`;
    }

    const steps = [0, 1, 2, 3, 4, 5, 6, 7];
    steps.forEach(step => {
        it(`should sort dates and vals — step=${step}`, function (done) {
            var testClient = new TestClient(torqueMapConfig(step));
            testClient.getTile(0, 0, 0, { layer: 0, format: 'png' }, function (err, torqueTile) {
                assert.ok(!err, err);
                assert.imageEqualsFile(torqueTile, torquePngFixture(step), IMAGE_TOLERANCE_PER_MIL, function(err) {
                    assert.ok(!err);
                    done();
                });
            });
        });
    });

    it('should sort dates and vals torque.json', function (done) {
        var testClient = new TestClient(torqueMapConfig(undefined));
        testClient.getTile(0, 0, 0, { layer: 0, format: 'torque.json' }, function (err, torqueTile) {
            assert.ok(!err, err);
            assert.ok(torqueTile);
            assert.deepEqual(torqueTile, expectedTorqueTile);
            done();
        });
    });
});
