require('../support/test_helper');

var assert = require('../support/assert');
var TestClient = require('../support/test_client');

describe('torque regression', function() {

    it('regression london point', function(done) {
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

        var testClient = new TestClient(londonPointMapConfig);
        testClient.getTile(2, 1, 1, {layer: 0, format: 'torque.json'}, function(err, torqueTile) {
            assert.ok(!err);
            assert.deepEqual(torqueTile, [{
                x__uint8: 255,
                y__uint8: 172,
                vals__uint8: [1],
                dates__uint16: [0]
            }]);

            done();
        });
    });

    it('should consider resolution for least value in query', function(done) {
        var resolutionTwoMapConfig =  {
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

        var testClient = new TestClient(resolutionTwoMapConfig);
        testClient.getTile(13, 4255, 2765, {layer: 0, format: 'torque.json'}, function(err, torqueTile) {
            assert.ok(!err);
            assert.deepEqual(torqueTile, [
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
