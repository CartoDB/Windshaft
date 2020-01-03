'use strict';

require('../support/test_helper');

var assert = require('../support/assert');
var TestClient = require('../support/test_client');

describe('basic grid json', function () {
    it('get grid', function (done) {
        var mapConfig = TestClient.singleLayerMapConfig('select * from test_table', null, null, 'name');
        var testClient = new TestClient(mapConfig);
        testClient.getTile(13, 4011, 3088, { layer: 0, format: 'grid.json' }, function (err, tile) {
            assert.ifError(err);
            assert.utfgridEqualsFile(tile, './test/fixtures/test_table_13_4011_3088.grid.json', 2, done);
        });
    });

    it("get'ing a json with default style and single interactivity should return a grid", function (done) {
        var mapConfig = TestClient.singleLayerMapConfig('select * from test_table', null, null, 'name');
        var testClient = new TestClient(mapConfig);
        testClient.getTile(13, 4011, 3088, { layer: 0, format: 'grid.json' }, function (err, tile) {
            assert.ifError(err);
            var expectedJson = {
                1: { name: 'Hawai' },
                2: { name: 'El Estocolmo' },
                3: { name: 'El Rey del Tallarín' },
                4: { name: 'El Lacón' },
                5: { name: 'El Pico' }
            };
            assert.deepEqual(tile.data, expectedJson);
            done();
        });
    });

    it("get'ing a json with default style and no interactivity should return an error", function (done) {
        var mapConfig = TestClient.singleLayerMapConfig('select * from test_table');
        var testClient = new TestClient(mapConfig);
        testClient.getTile(13, 4011, 3088, { layer: 0, format: 'grid.json' }, function (err) {
            assert.ok(err);
            assert.equal(err.message, 'Tileset has no interactivity');
            done();
        });
    });

    // See http://github.com/Vizzuality/Windshaft/issues/50
    it("get'ing a json with no data should return an empty grid", function (done) {
        var query = 'select * from test_table limit 0';
        var mapConfig = TestClient.singleLayerMapConfig(query, null, null, 'name');
        var testClient = new TestClient(mapConfig);
        testClient.getTile(13, 4011, 3088, { layer: 0, format: 'grid.json' }, function (err, tile) {
            assert.ifError(err);
            assert.utfgridEqualsFile(tile, './test/fixtures/test_table_13_4011_3088_empty.grid.json', 2, done);
        });
    });

    // Another test for http://github.com/Vizzuality/Windshaft/issues/50
    it("get'ing a json with no data but interactivity should return an empty grid", function (done) {
        var query = 'SELECT * FROM test_table limit 0';
        var mapConfig = TestClient.singleLayerMapConfig(query, null, null, 'cartodb_id');
        var testClient = new TestClient(mapConfig);
        testClient.getTile(13, 4011, 3088, { layer: 0, format: 'grid.json' }, function (err, tile) {
            assert.ifError(err);
            assert.utfgridEqualsFile(tile, './test/fixtures/test_table_13_4011_3088_empty.grid.json', 2, done);
        });
    });

    // See https://github.com/Vizzuality/Windshaft-cartodb/issues/67
    it("get'ing a solid grid while changing interactivity fields", function (done) {
        var query = 'SELECT * FROM test_big_poly';
        var style211 = '#test_big_poly{polygon-fill:blue;}'; // for solid
        var mapConfigName = TestClient.singleLayerMapConfig(query, style211, null, 'name');
        var testClient = new TestClient(mapConfigName);
        testClient.getTile(3, 2, 2, { layer: 0, format: 'grid.json' }, function (err, tile) {
            assert.ifError(err);
            var expectedData = { 1: { name: 'west' } };
            assert.deepEqual(tile.data, expectedData);

            var mapConfigCartodbId = TestClient.singleLayerMapConfig(query, style211, null, 'cartodb_id');
            testClient = new TestClient(mapConfigCartodbId);
            testClient.getTile(3, 2, 2, { layer: 0, format: 'grid.json' }, function (err, tile) {
                assert.ifError(err);
                var expectedData = { 1: { cartodb_id: '1' } };
                assert.deepEqual(tile.data, expectedData);
                done();
            });
        });
    });
});
