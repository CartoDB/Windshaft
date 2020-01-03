'use strict';

require('../support/test-helper');

var assert = require('../support/assert');
var TestClient = require('../support/test-client');
var testQueryRewriter = {
    query: function (query, data) {
        var table = (data && data.table) || 'test_table';
        return 'SELECT * FROM ' + table;
    }
};

describe('server_gettile', function () {
    var IMAGE_EQUALS_TOLERANCE_PER_MIL = 2;

    function imageCompareFn (fixture, done) {
        return function (err, tile) {
            if (err) {
                return done(err);
            }
            assert.imageEqualsFile(tile, './test/fixtures/' + fixture, IMAGE_EQUALS_TOLERANCE_PER_MIL, done);
        };
    }

    it('should by default not rewrite queries', function (done) {
        var mapConfig = TestClient.singleLayerMapConfig('SELECT * FROM _vovw_12_test_table');
        new TestClient(mapConfig)
            .getTile(11, 1002, 772, imageCompareFn('_vovw_12_test_table_11_1002_772.png', done));
    });

    it('should rewrite queries', function (done) {
        var options = {
            mapnik: {
                mapnik: Object.assign({}, TestClient.mapnikOptions, { queryRewriter: testQueryRewriter })
            }
        };
        var mapConfig = TestClient.singleLayerMapConfig('SELECT * FROM _vovw_12_test_table');
        new TestClient(mapConfig, options)
            .getTile(11, 1002, 772, imageCompareFn('test_table_11_1002_772.png', done));
    });

    it('should rewrite queries with passed data', function (done) {
        var options = {
            mapnik: {
                mapnik: Object.assign({}, TestClient.mapnikOptions, { queryRewriter: testQueryRewriter })
            }
        };
        var mapConfig = TestClient.singleLayerMapConfig('SELECT * FROM test_table');
        mapConfig.layers[0].options.query_rewrite_data = {
            table: '_vovw_12_test_table'
        };
        new TestClient(mapConfig, options)
            .getTile(11, 1002, 772, imageCompareFn('_vovw_12_test_table_11_1002_772.png', done));
    });
});
