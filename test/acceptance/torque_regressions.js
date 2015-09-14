require('../support/test_helper');

var assert = require('../support/assert');
var redis = require('redis');
var Windshaft = require('../../lib/windshaft');
var ServerOptions = require('../support/server_options');

describe('torque regression', function() {

    var layergroupIdToDelete = null;

    beforeEach(function() {
        layergroupIdToDelete = null;
    });

    afterEach(function(done) {
        var redisKey = 'map_cfg|' + layergroupIdToDelete;
        redis_client.del(redisKey, function () {
            done();
        });
    });

    var server = new Windshaft.Server(ServerOptions);
    server.setMaxListeners(0);
    var redis_client = redis.createClient(ServerOptions.redis.port);

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

    it('should consider resolution for least value in query', function(done) {
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
});
