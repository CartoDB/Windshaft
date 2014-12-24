var assert = require('assert');
var RendererParams= require('../../lib/windshaft/renderers/renderer_params');

suite('renderer_params', function() {

    test('can create a unique key from request, stripping xyz/callback', function(){
        var req = {params: {dbname: "windshaft_test", table: 'test_table', x: 4, y:4, z:4, sql:"select *", geom_type:'point', format:'png' }};

        assert.equal(RendererParams.createKey(req.params), 'windshaft_test:test_table::png:point:select *::::');
    });

    test('cache key includes style', function(){
        var req = {params: {dbname: "windshaft_test", table: 'test_table', x: 4, y:4, z:4, geom_type:'point', style:"#test_table{}", format:'png' }};

        assert.equal(RendererParams.createKey(req.params), 'windshaft_test:test_table::png:point::::#test_table{}:');
    });

    test('cache key includes style_version', function(){
        var req = {params: {dbname: "windshaft_test", table: 'test_table', x: 4, y:4, z:4, geom_type:'point', style:"#test_table{}", format:'png', style_version:'2.1.0' }};

        assert.equal(RendererParams.createKey(req.params), 'windshaft_test:test_table::png:point::::#test_table{}:2.1.0');
    });

    // WARNING!
    // This behavior is (ab)used by Windshaft-cartodb to balance between different dbhosts
    // so renderer caches get reused when there is another one open with same dbuser
    // but different dbhost. Please do not disable unless this is taken into account.
    test('cache key includes dbname and dbuser but not dbhost', function(){
        var req1 = {params: {dbhost: "1.2.3.4", dbuser: "windshaft_user", dbname: "windshaft_test", table: 'test_table', x: 4, y:4, z:4, geom_type:'point', style:"#test_table{}", format:'png', style_version:'2.1.0' }};
        var req2 = {params: {dbhost: "1.2.3.5", dbuser: "windshaft_user", dbname: "windshaft_test", table: 'test_table', x: 4, y:4, z:4, geom_type:'point', style:"#test_table{}", format:'png', style_version:'2.1.0' }};
        assert.equal(RendererParams.createKey(req1.params), RendererParams.createKey(req2.params));
    });

});
