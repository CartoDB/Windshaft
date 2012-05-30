var   _         = require('underscore')
    , sys       = require('sys')
    , th        = require('../test_helper.js')
    , assert    = require('assert')
    , grainstore= require('grainstore')
    , RenderCache = require('../../lib/windshaft/render_cache.js')
    , tests       = module.exports = {}
    , serverOptions = require('../server_options')();

// initialize core mml_store
var mml_store  = new grainstore.MMLStore(serverOptions.redis, serverOptions.grainstore);

tests['true'] = function() {
    assert.eql(global.environment.name, 'test');
};

tests['render_cache has a cached of render objects'] = function(){
    var render_cache = new RenderCache(100, mml_store);
    assert.ok(_.isObject(render_cache.renderers));
};

tests['render_cache can create a unique key from request, stripping xyz/callback'] = function(){
    var render_cache = new RenderCache(100, mml_store);
    var req = {params: {dbname: "windshaft_test", table: 'test_table', x: 4, y:4, z:4, sql:"select *", geom_type:'point', format:'png' }};

    assert.eql(render_cache.createKey(req.params), 'windshaft_test:test_table:png:point:select *::');
};

/**
* THE FOLLOWING TESTS NEED SOME DB SETUP
* They need a database setup as below with the table test_table defined
*/

tests['render_cache can generate a tilelive object'] = function(){
    var render_cache = new RenderCache(100, mml_store);
    var req = {params: {dbname: "windshaft_test", table: 'test_table', x: 4, y:4, z:4, geom_type:'polygon', format:'png' }};

    render_cache.getRenderer(req, function(err, renderer){
        assert.eql(renderer._uri.query.base.split(':')[0], 'windshaft_test');
    });
};


tests['render_cache can generate > 1 tilelive object'] = function(){
    var render_cache = new RenderCache(100, mml_store);
    var req = {params: {dbname: "windshaft_test", table: 'test_table', x: 4, y:4, z:4, geom_type:'polygon', format:'png' }};

    render_cache.getRenderer(req, function(err, renderer){
        req = {params: {dbname: "windshaft_test", table: 'test_table_2', x: 4, y:4, z:4, geom_type:'polygon', format:'png' }};
        render_cache.getRenderer(req, function(err, renderer2){
            assert.eql(_.keys(render_cache.renderers).length, 2);
        });
    });
};


tests['render_cache can reuse tilelive object'] = function(){
    var render_cache = new RenderCache(100, mml_store);
    var req = {params: {dbname: "windshaft_test", table: 'test_table', x: 4, y:4, z:4, geom_type:'polygon', format:'png' }};

    render_cache.getRenderer(req, function(err, renderer){
        render_cache.getRenderer(req, function(err, renderer){
            assert.eql(_.keys(render_cache.renderers).length, 1);
        });
    });
};

tests['render_cache can delete all tilelive objects when reset'] = function(){
    var render_cache = new RenderCache(100, mml_store);

    var req = {params: {dbname: "windshaft_test", table: 'test_table', x: 4, y:4, z:4, geom_type:'polygon', format:'png' }};
    render_cache.getRenderer(req, function(err, renderer){

        var req = {params: {dbname: "windshaft_test", table: 'test_table', x: 4, y:4, z:4, geom_type:'polygon', format:'png',
            sql: "(SELECT * FROM test_table LIMIT 50) as q" }};
        render_cache.getRenderer(req, function(err, renderer){
            assert.eql(_.keys(render_cache.renderers).length, 2);

            render_cache.reset(req);

            assert.eql(_.keys(render_cache.renderers).length, 0);
        });
    });
};


tests['render_cache can delete only related tilelive objects when reset'] = function(){
    var render_cache = new RenderCache(100, mml_store);

    var req = {params: {dbname: "windshaft_test", table: 'test_table', x: 4, y:4, z:4, geom_type:'polygon', format:'png' }};
    render_cache.getRenderer(req, function(err, renderer){
        req.params.sql = "(SELECT * FROM test_table LIMIT 50) as q";

        render_cache.getRenderer(req, function(err, renderer){
            delete req.params.sql;
            req.params.table = 'test_table_2';

            render_cache.getRenderer(req, function(err, renderer){
                assert.eql(_.keys(render_cache.renderers).length, 3);

                req.params.table = 'test_table';
                render_cache.reset(req);

                assert.eql(_.keys(render_cache.renderers).length, 1);
            });
        });
    });
};


tests['render_cache can purge all tilelive objects'] = function(){
    var render_cache = new RenderCache(100, mml_store);

    var req = {params: {dbname: "windshaft_test", table: 'test_table', x: 4, y:4, z:4, geom_type:'polygon', format:'png' }};

    render_cache.getRenderer(req, function(err, renderer){
        req.params.sql = "(SELECT * FROM test_table LIMIT 50) as q";

        render_cache.getRenderer(req, function(err, renderer){
            delete req.params.sql;
            req.params.table = 'test_table_2';

            render_cache.getRenderer(req, function(err, renderer){
                assert.eql(_.keys(render_cache.renderers).length, 3);

                req.params.table = 'test_table';
                render_cache.purge();

                assert.eql(_.keys(render_cache.renderers).length, 0);
            });
        });
    });
};

tests['render_cache automatically deletes tilelive only after timeout'] = function(){
    var render_cache = new RenderCache(5, mml_store);
    var req = {params: {dbname: "windshaft_test", table: 'test_table', x: 4, y:4, z:4, geom_type:'polygon', format:'png' }};

    render_cache.getRenderer(req, function(err, renderer){
        assert.eql(_.keys(render_cache.renderers).length, 1);
        setTimeout(function(){assert.eql(_.keys(render_cache.renderers).length, 0);},10);
    });
};
