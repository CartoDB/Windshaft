require('../support/test_helper.js');

var _ = require('underscore');
var assert = require('assert');
var RenderCache = require('../../lib/windshaft/renderers/render_cache');
var MapStore = require('../../lib/windshaft/storages/mapstore');
var MapConfig = require('../../lib/windshaft/models/mapconfig');
var RendererFactory = require('../../lib/windshaft/renderers/renderer_factory');
var RedisPool = require('redis-mpool');
var serverOptions = require('../support/server_options');

describe('render_cache', function() {

    var redisPool = new RedisPool(serverOptions.redis);

    var rendererFactory = new RendererFactory({
        mapnik: {
            redisPool: redisPool,
            grainstore: serverOptions.grainstore
        }
    });

    var mapConfig = MapConfig.create({
        layers: [
            {
                type: 'mapnik',
                options: {
                    sql: 'select 1 id, null::geometry the_geom',
                    cartocss: '#layer { }',
                    cartocss_version: '2.3.0'
                }
            }
        ]
    });

    var mapConfig2 = MapConfig.create({
        layers: [
            {
                type: 'mapnik',
                options: {
                    sql: 'select 2 id, null::geometry the_geom',
                    cartocss: '#layer { }',
                    cartocss_version: '2.3.0'
                }
            }
        ]
    });

    var mapStore = new MapStore({pool: redisPool});

    function requestParams(params) {
        return _.extend({
            dbname: "windshaft_test",
            token: mapConfig.id(),
            dbuser: 'postgres',
            format: 'png',
            layer: undefined,
            scale_factor: 1
        }, params);
    }

    function makeRenderCache(opts) {
        opts = opts || { timeout: 10000 };
        return new RenderCache(opts, mapStore, rendererFactory);
    }


    beforeEach(function(done) {
        mapStore.save(mapConfig, function(err) {
            if (err) {
                return done(err);
            }
            mapStore.save(mapConfig2, done);
        });
    });

    afterEach(function(done) {
        mapStore.del(mapConfig.id(), function() {
            mapStore.del(mapConfig2.id(), function() {
                done();
            });
        });
    });

    it('has a cache of render objects', function(){
        var render_cache = makeRenderCache();
        assert.ok(_.isObject(render_cache.renderers));
    });

    /**
     * THE FOLLOWING TESTS NEED SOME DB SETUP
     * They need a database setup as below with the table test_table defined
     */

    it('can generate a tilelive object', function(done){
        var render_cache = makeRenderCache();
        var req = {
            params: requestParams()
        };

        render_cache.getRenderer(req, function(err, renderer){
            assert.ok(renderer, err);
            assert.ok(renderer.get(), err);
            assert.equal(renderer.get()._uri.protocol, 'mapnik:');
            done();
        });
    });


    it('can generate > 1 tilelive object', function(done){
        var render_cache = makeRenderCache();

        var req = {
            params: requestParams()
        };

        render_cache.getRenderer(req, function(err, renderer){
            assert.ok(renderer, err);
            req = {
                params: requestParams({
                    token: mapConfig2.id()
                })
            };
            render_cache.getRenderer(req, function(/*err, renderer2*/) {
                assert.equal(_.keys(render_cache.renderers).length, 2);
                done();
            });
        });
    });


    it('can reuse tilelive object', function(done){
        var render_cache = makeRenderCache();
        var req = {
            params: requestParams()
        };

        render_cache.getRenderer(req, function(err, renderer){
            assert.ok(renderer, err);
            render_cache.getRenderer(req, function(/*err, renderer*/) {
                assert.equal(_.keys(render_cache.renderers).length, 1);
                done();
            });
        });
    });

    it('can delete all tilelive objects when reset', function(done){
        var render_cache = makeRenderCache();

        var req = {
            params: requestParams()
        };

        render_cache.getRenderer(req, function(err, renderer){
            assert.ok(renderer, err);
            assert.equal(_.keys(render_cache.renderers).length, 1);

            var req = {
                params: requestParams({ scale_factor: 2})
            };
            render_cache.getRenderer(req, function(/*err, renderer*/) {
                assert.equal(_.keys(render_cache.renderers).length, 2);
                render_cache.reset(req);
                assert.equal(_.keys(render_cache.renderers).length, 0);
                done();
            });
        });
    });


    it('can delete only related tilelive objects when reset', function(done){
        var render_cache = makeRenderCache();

        var req = {
            params: requestParams()
        };
        render_cache.getRenderer(req, function(err, renderer){
            assert.ok(renderer, err);
            req.params.scale_factor = 2;

            render_cache.getRenderer(req, function(/*err, renderer*/) {
                delete req.params.scale_factor;
                req.params.token = mapConfig2.id();

                render_cache.getRenderer(req, function(/*err, renderer*/) {
                    assert.equal(_.keys(render_cache.renderers).length, 3);

                    req.params.token = mapConfig.id();
                    render_cache.reset(req);

                    assert.equal(_.keys(render_cache.renderers).length, 1);

                    done();
                });
            });
        });
    });

    // See https://github.com/Vizzuality/Windshaft/issues/59
    it('clears both auth and non-auth renderer caches on reset', function(done){
        var render_cache = makeRenderCache();

        var req = {
            params: requestParams()
        };
        render_cache.getRenderer(req, function(err, renderer){
            assert.ok(renderer, err);
            // This needs an existing pg user that can connect to
            // the database. Failure to connect would result in the
            // renderer not staying in the cache, as per
            // http://github.com/CartoDB/Windshaft/issues/171
            req.params = requestParams({
                dbuser: 'test_ws_publicuser',
                dbpassword: 'public'
            });

            render_cache.getRenderer(req, function(/*err, renderer*/) {
                req.params = requestParams({ token: mapConfig2.id() });

                render_cache.getRenderer(req, function(/*err, renderer*/) {
                    assert.equal(_.keys(render_cache.renderers).length, 3);

                    req.params = requestParams();
                    render_cache.reset(req);

                    assert.equal(_.keys(render_cache.renderers).length, 1, _.keys(render_cache.renderers).join('\n'));

                    done();
                });
            });
        });
    });


    it('can purge all tilelive objects', function(done){
        var render_cache = makeRenderCache();

        var req = {
            params: requestParams()
        };

        render_cache.getRenderer(req, function(err, renderer){
            assert.ok(renderer, err);
            req.params.scale_factor = 2;

            render_cache.getRenderer(req, function(/*err, renderer*/) {
                delete req.params.scale_factor;
                req.params.token = mapConfig2.id();

                render_cache.getRenderer(req, function(/*err, renderer*/) {
                    assert.equal(_.keys(render_cache.renderers).length, 3);

                    req.params.token = mapConfig.id();
                    render_cache.purge();

                    assert.equal(_.keys(render_cache.renderers).length, 0);

                    done();
                });
            });
        });
    });

    it('automatically deletes tilelive only after timeout', function(done){
        var render_cache = makeRenderCache({timeout: 100});
        var req = {
            params: requestParams()
        };
        render_cache.getRenderer(req, function(err, renderer){
            assert.ok(renderer, err);
            assert.equal(_.keys(render_cache.renderers).length, 1);

            setTimeout(function() {
                assert.equal(_.keys(render_cache.renderers).length, 0);
                done();
            },200);
        });
    });

    // Remove from cache renderers erroing out
    // See https://github.com/CartoDB/Windshaft/issues/171
    it('does not keep erroring renderers in cache', function(done){
        var render_cache = makeRenderCache();
        assert.equal(_.keys(render_cache.renderers).length, 0);
        var req = {
            params: requestParams({ token: 'nonexistant' })
        };
        render_cache.getRenderer(req, function(err/*, renderer*/) {
            assert.ok(err);
            // Need next tick as the renderer is removed from
            // the cache after the callback is invoked
            setTimeout(function() {
              err = null;
              try {
                assert.equal(_.keys(render_cache.renderers).length, 0);
              }
              catch (e) { err = e; }
              done(err);
            }, 0);
        });
    });

    it('does not keep renderers in cache for unexistent tokes', function(done) {
        var renderCache = makeRenderCache();
        assert.equal(Object.keys(renderCache.renderers).length, 0);
        var req = {
            params: requestParams({ token: "wadus" })
        };
        renderCache.getRenderer(req, function(err/*, renderer*/) {
            assert.ok(err);
            assert.equal(Object.keys(renderCache.renderers).length, 0);
            done();
        });
    });

});
