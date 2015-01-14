var assert = require('assert');
var RendererParams = require('../../lib/windshaft/renderers/renderer_params');
var _ = require('underscore');

suite('renderer_params', function() {

    var SUITE_COMMON_PARAMS = {
        dbname: 'windshaft_test',
        table: 'test_table',
        x: 4,
        y: 4,
        z: 4,
        geom_type: 'point',
        format: 'png'
    };

    test('can create a unique key from request, stripping xyz/callback', function(){
        var req = { params: _.extend({}, SUITE_COMMON_PARAMS, { sql: "select *"}) };

        assert.equal(RendererParams.createKey(req.params), 'windshaft_test:test_table::png:point:select *:::::1');
    });

    test('cache key includes style', function(){
        var req = { params: _.extend({}, SUITE_COMMON_PARAMS, { style: "#test_table{}" }) };

        assert.equal(RendererParams.createKey(req.params), 'windshaft_test:test_table::png:point::::#test_table{}::1');
    });

    test('cache key includes style_version', function(){
        var req = { params: _.extend({}, SUITE_COMMON_PARAMS, { style:"#test_table{}", style_version:'2.1.0' }) };

        assert.equal(RendererParams.createKey(req.params), 'windshaft_test:test_table::png:point::::#test_table{}:2.1.0:1');
    });

    test('cache key includes style_version', function(){
        var req = { params: _.extend({}, SUITE_COMMON_PARAMS, { style:"#test_table{}", style_version:'2.1.0', scale_factor: 2 }) };

        assert.equal(RendererParams.createKey(req.params), 'windshaft_test:test_table::png:point::::#test_table{}:2.1.0:2');
    });

    // WARNING!
    // This behavior is (ab)used by Windshaft-cartodb to balance between different dbhosts
    // so renderer caches get reused when there is another one open with same dbuser
    // but different dbhost. Please do not disable unless this is taken into account.
    test('cache key includes dbname and dbuser but not dbhost', function(){
        var req1 = requestStub({dbhost: "1.2.3.4", dbuser: "windshaft_user", style:"#test_table{}", style_version:'2.1.0' });
        var req2 = { params: _.extend({}, SUITE_COMMON_PARAMS, {dbhost: "1.2.3.5", dbuser: "windshaft_user", style:"#test_table{}", style_version:'2.1.0' }) };
        assert.equal(RendererParams.createKey(req1.params), RendererParams.createKey(req2.params));
    });

    function requestStub(params) {
        return {
            params: _.extend({}, SUITE_COMMON_PARAMS, params)
        };
    }

});
