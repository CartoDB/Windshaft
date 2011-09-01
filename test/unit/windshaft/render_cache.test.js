var   _         = require('underscore')
    , th        = require('../../test_helper')
    , assert    = require('assert')
    , RenderCache = require('../../../lib/windshaft/render_cache')
    , tests       = module.exports = {};

var render_cache = new RenderCache();

tests['true'] = function() {
    assert.eql(global.environment.name, 'test');
};

tests['render_cache has a cached of render objects'] = function(){
    assert.ok(_.isObject(render_cache.renderers));
};

tests['render_cache can create a unique key from request, stripping xyz/callback'] = function(){
    var req = {params: {dbname: "vizzuality", table: 'my_table', x: 4, y:4, z:4, sql:"select *", geom_type:'point', format:'png' }};

    assert.eql(render_cache.createKey(req.params), 'vizzuality:my_table:png:point:select *:');
};

/**
 * THE FOLLOWING TESTS NEED SOME DB SETUP
 * They need a database setup as below with the table ine_poly defined
 */

tests['render_cache can generate a tilelive object'] = function(){
    var req = {params: {dbname: "cartodb_user_123_db", table: 'ine_poly', x: 4, y:4, z:4, geom_type:'polygon', format:'png' }};

    render_cache.getRenderer(req, function(err, renderer){
        assert.eql(renderer._uri.query.base, 'cartodb_user_123_db:ine_poly:png:polygon::');
    });
};


tests['render_cache can generate > 1 tilelive object'] = function(){
    var req = {params: {dbname: "cartodb_user_123_db", table: 'ine_poly', x: 4, y:4, z:4, geom_type:'polygon', format:'png' }};

    render_cache.getRenderer(req, function(err, renderer){
        var req = {params: {dbname: "cartodb_user_123_db", table: 'gadm4', x: 4, y:4, z:4, geom_type:'polygon', format:'png' }};

        render_cache.getRenderer(req, function(err, renderer){
            assert.eql(_.keys(render_cache.renderers).length, 2);
        });
    });
};


tests['render_cache can reuses tilelive object'] = function(){
    var req = {params: {dbname: "cartodb_user_123_db", table: 'ine_poly', x: 4, y:4, z:4, geom_type:'polygon', format:'png' }};

    render_cache.getRenderer(req, function(err, renderer){
        render_cache.getRenderer(req, function(err, renderer){
            assert.eql(_.keys(render_cache.renderers).length, 1);
        });
    });
};

tests['render_cache can delete all tilelive objects when reset'] = function(){

    var solo_render_cache = new RenderCache();
    var req = {params: {dbname: "cartodb_user_123_db", table: 'ine_poly', x: 4, y:4, z:4, geom_type:'polygon', format:'png' }};

    solo_render_cache.getRenderer(req, function(err, renderer){
        var req = {params: {dbname: "cartodb_user_123_db", table: 'ine_poly', x: 4, y:4, z:4, geom_type:'polygon', format:'png',
            sql: "(SELECT * FROM ine_poly LIMIT 50) as q" }};

        solo_render_cache.getRenderer(req, function(err, renderer){
            assert.eql(_.keys(solo_render_cache.renderers).length, 2);

            solo_render_cache.reset(req);

            assert.eql(_.keys(solo_render_cache.renderers).length, 0);
        });
    });
};

tests['render_cache can delete only related tilelive objects when reset'] = function(){

    var solo_render_cache = new RenderCache();
    var req = {params: {dbname: "cartodb_user_123_db", table: 'ine_poly', x: 4, y:4, z:4, geom_type:'polygon', format:'png' }};

    solo_render_cache.getRenderer(req, function(err, renderer){
        req.params.sql = "(SELECT * FROM ine_poly LIMIT 50) as q";

        solo_render_cache.getRenderer(req, function(err, renderer){
            delete req.params.sql;
            req.params.table = 'gadm4';

            solo_render_cache.getRenderer(req, function(err, renderer){
                assert.eql(_.keys(solo_render_cache.renderers).length, 3);

                req.params.table = 'ine_poly';
                solo_render_cache.reset(req);

                assert.eql(_.keys(solo_render_cache.renderers).length, 1);
            });
        });
    });
};


tests['render_cache can purge all tilelive objects'] = function(){
    var solo_render_cache = new RenderCache();
    var req = {params: {dbname: "cartodb_user_123_db", table: 'ine_poly', x: 4, y:4, z:4, geom_type:'polygon', format:'png' }};

    solo_render_cache.getRenderer(req, function(err, renderer){
        req.params.sql = "(SELECT * FROM ine_poly LIMIT 50) as q";

        solo_render_cache.getRenderer(req, function(err, renderer){
            delete req.params.sql;
            req.params.table = 'gadm4';

            solo_render_cache.getRenderer(req, function(err, renderer){
                assert.eql(_.keys(solo_render_cache.renderers).length, 3);

                req.params.table = 'ine_poly';
                solo_render_cache.purge();

                assert.eql(_.keys(solo_render_cache.renderers).length, 0);
            });
        });
    });
};
