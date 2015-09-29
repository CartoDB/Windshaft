require('../support/test_helper');

var assert = require('assert');
var MapStoreProvider = require('../../lib/windshaft/models/providers/mapstore_mapconfig_provider');
var _ = require('underscore');

describe('renderer_params', function() {

    var SUITE_COMMON_PARAMS = {
        dbname: 'windshaft_test',
        token: 'test_token',
        x: 4,
        y: 4,
        z: 4,
        format: 'png'
    };

    it('can create a unique key from request, stripping xyz/callback', function(){
        var params = _.extend({}, SUITE_COMMON_PARAMS);

        assert.equal(MapStoreProvider.createKey(params), 'windshaft_test:test_token::png::1');
    });

    it('cache key includes layer', function(){
        var params = _.extend({}, SUITE_COMMON_PARAMS, { layer: 1 });

        assert.equal(MapStoreProvider.createKey(params), 'windshaft_test:test_token::png:1:1');
    });

    it('cache key includes scale_factor', function(){
        var params = _.extend({}, SUITE_COMMON_PARAMS, { scale_factor: 2 });

        assert.equal(MapStoreProvider.createKey(params), 'windshaft_test:test_token::png::2');
    });

    it('cache key includes dbuser', function(){
        var params = _.extend({}, SUITE_COMMON_PARAMS, { dbuser:"wadus_user" });

        assert.equal(MapStoreProvider.createKey(params), 'windshaft_test:test_token:wadus_user:png::1');
    });

    // WARNING!
    // This behavior is (ab)used by Windshaft-cartodb to balance between different dbhosts
    // so renderer caches get reused when there is another one open with same dbuser
    // but different dbhost. Please do not disable unless this is taken into account.
    it('cache key includes dbname and dbuser but not dbhost', function(){
        var params1 = requestStub({dbhost: "1.2.3.4", dbuser: "windshaft_user", layer: 1, scale_factor: 2 });
        var params2 = _.extend({}, SUITE_COMMON_PARAMS, {
            dbhost: "1.2.3.5", dbuser: "windshaft_user", layer: 1, scale_factor: 2
        });
        assert.equal(MapStoreProvider.createKey(params1), MapStoreProvider.createKey(params2));
    });

    function requestStub(params) {
        return _.extend({}, SUITE_COMMON_PARAMS, params);
    }

});
