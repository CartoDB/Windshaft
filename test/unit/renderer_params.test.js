var assert = require('assert');
var RendererParams = require('../../lib/windshaft/renderers/renderer_params');
var _ = require('underscore');

suite('renderer_params', function() {

    var SUITE_COMMON_PARAMS = {
        dbname: 'windshaft_test',
        token: 'test_token',
        x: 4,
        y: 4,
        z: 4,
        format: 'png'
    };

    test('can create a unique key from request, stripping xyz/callback', function(){
        var req = { params: _.extend({}, SUITE_COMMON_PARAMS) };

        assert.equal(RendererParams.createKey(req.params), 'windshaft_test:test_token::png::1');
    });

    test('cache key includes layer', function(){
        var req = { params: _.extend({}, SUITE_COMMON_PARAMS, { layer: 1 }) };

        assert.equal(RendererParams.createKey(req.params), 'windshaft_test:test_token::png:1:1');
    });

    test('cache key includes scale_factor', function(){
        var req = { params: _.extend({}, SUITE_COMMON_PARAMS, { scale_factor: 2 }) };

        assert.equal(RendererParams.createKey(req.params), 'windshaft_test:test_token::png::2');
    });

    test('cache key includes dbuser', function(){
        var req = { params: _.extend({}, SUITE_COMMON_PARAMS, { dbuser:"wadus_user" }) };

        assert.equal(RendererParams.createKey(req.params), 'windshaft_test:test_token:wadus_user:png::1');
    });

    // WARNING!
    // This behavior is (ab)used by Windshaft-cartodb to balance between different dbhosts
    // so renderer caches get reused when there is another one open with same dbuser
    // but different dbhost. Please do not disable unless this is taken into account.
    test('cache key includes dbname and dbuser but not dbhost', function(){
        var req1 = requestStub({dbhost: "1.2.3.4", dbuser: "windshaft_user", layer: 1, scale_factor: 2 });
        var req2 = { params: _.extend({}, SUITE_COMMON_PARAMS, {dbhost: "1.2.3.5", dbuser: "windshaft_user", layer: 1, scale_factor: 2 }) };
        assert.equal(RendererParams.createKey(req1.params), RendererParams.createKey(req2.params));
    });

    function requestStub(params) {
        return {
            params: _.extend({}, SUITE_COMMON_PARAMS, params)
        };
    }

});
