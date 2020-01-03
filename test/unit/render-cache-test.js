'use strict';

require('../support/test-helper');

var assert = require('assert');
var RendererCache = require('../../lib/cache/renderer-cache');
var MapStore = require('../../lib/storages/mapstore');
var MapConfig = require('../../lib/models/mapconfig');
var MapStoreMapConfigProvider = require('../../lib/models/providers/mapstore-mapconfig-provider');
var RendererFactory = require('../../lib/renderers/renderer-factory');
var RedisPool = require('redis-mpool');

describe('renderCache', function () {
    var redisPool = new RedisPool(global.environment.redis);

    var rendererFactory = new RendererFactory({
        mapnik: {
            grainstore: {
                mapnik_version: '3.0.15'
            }
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
                    cartocss_version: '2.3.0',
                    'cache-features': false
                }
            }
        ]
    });

    var mapStore = new MapStore({ pool: redisPool });

    function requestParams (params) {
        return Object.assign({
            dbname: 'windshaft_test',
            token: mapConfig.id(),
            dbuser: 'postgres',
            format: 'png',
            layer: undefined,
            scale_factor: 1
        }, params);
    }

    function createMapConfigProvider (extendParams) {
        return new MapStoreMapConfigProvider(mapStore, requestParams(extendParams));
    }

    function makeRenderCache (opts) {
        opts = opts || { timeout: 10000 };
        return new RendererCache(rendererFactory, opts);
    }

    beforeEach(function (done) {
        mapStore.save(mapConfig, function (err) {
            if (err) {
                return done(err);
            }
            mapStore.save(mapConfig2, done);
        });
    });

    afterEach(function (done) {
        mapStore.del(mapConfig.id(), function () {
            mapStore.del(mapConfig2.id(), function () {
                done();
            });
        });
    });

    it('has a cache of render objects', function () {
        var renderCache = makeRenderCache();
        assert.ok(typeof renderCache.renderers === 'object');
    });

    /**
     * THE FOLLOWING TESTS NEED SOME DB SETUP
     * They need a database setup as below with the table test_table defined
     */

    it('can generate a renderer', function (done) {
        var renderCache = makeRenderCache();

        renderCache.getRenderer(createMapConfigProvider(), function (err, renderer) {
            assert.ok(renderer, err);
            assert.ok(renderer.get(), err);
            assert.ok(renderer.get().xml);
            done();
        });
    });

    it('Works with cache-features (Default = true)', function (done) {
        var renderCache = makeRenderCache();

        renderCache.getRenderer(createMapConfigProvider(), function (err, renderer) {
            assert.ok(renderer, err);
            assert.ok(renderer.get(), err);
            assert(renderer.get().xml.indexOf('cache-features="true"') > -1);
            done();
        });
    });

    it('Works with cache-features = false as parameter', function (done) {
        var renderCache = makeRenderCache();

        renderCache.getRenderer(createMapConfigProvider({ 'cache-features': false }), function (err, renderer) {
            assert.ok(renderer, err);
            assert.ok(renderer.get(), err);
            assert(renderer.get().xml.indexOf('cache-features="false"') > -1);
            done();
        });
    });

    it('Ignores cache-features = false in layer', function (done) {
        var renderCache = makeRenderCache();

        renderCache.getRenderer(createMapConfigProvider({ token: mapConfig2.id() }), function (err, renderer) {
            assert.ok(renderer, err);
            assert.ok(renderer.get(), err);
            assert(renderer.get().xml.indexOf('cache-features="true"') > -1);
            done();
        });
    });

    it('can generate > 1 renderer', function (done) {
        var renderCache = makeRenderCache();

        renderCache.getRenderer(createMapConfigProvider(), function (err, renderer) {
            assert.ok(renderer, err);
            renderCache.getRenderer(createMapConfigProvider({ token: mapConfig2.id() }), function (/* err, renderer2 */) {
                assert.equal(Object.keys(renderCache.renderers).length, 2);
                done();
            });
        });
    });

    it('can reuse renderer', function (done) {
        var renderCache = makeRenderCache();

        var provider = createMapConfigProvider();
        renderCache.getRenderer(provider, function (err, renderer) {
            assert.ok(renderer, err);
            renderCache.getRenderer(provider, function (/* err, renderer */) {
                assert.equal(Object.keys(renderCache.renderers).length, 1);
                done();
            });
        });
    });

    it('can delete all renderers when reset', function (done) {
        var renderCache = makeRenderCache();

        var provider = createMapConfigProvider();
        renderCache.getRenderer(provider, function (err, renderer) {
            assert.ok(renderer, err);
            assert.equal(Object.keys(renderCache.renderers).length, 1);
            renderCache.getRenderer(createMapConfigProvider({ scale_factor: 2 }), function (/* err, renderer */) {
                assert.equal(Object.keys(renderCache.renderers).length, 2);
                renderCache.reset(provider);
                assert.equal(Object.keys(renderCache.renderers).length, 0);
                done();
            });
        });
    });

    it('can delete only related renderers when reset', function (done) {
        var renderCache = makeRenderCache();

        var provider = createMapConfigProvider();
        renderCache.getRenderer(provider, function (err, renderer) {
            assert.ok(renderer, err);
            provider = createMapConfigProvider({ scale_factor: 2 });
            renderCache.getRenderer(provider, function (/* err, renderer */) {
                provider = createMapConfigProvider({ token: mapConfig2.id() });
                renderCache.getRenderer(provider, function (/* err, renderer */) {
                    assert.equal(Object.keys(renderCache.renderers).length, 3);

                    provider = createMapConfigProvider({ token: mapConfig.id() });
                    renderCache.reset(provider);

                    assert.equal(Object.keys(renderCache.renderers).length, 1);

                    done();
                });
            });
        });
    });

    // See https://github.com/Vizzuality/Windshaft/issues/59
    it('clears both auth and non-auth renderer caches on reset', function (done) {
        var renderCache = makeRenderCache();

        var provider = createMapConfigProvider();
        renderCache.getRenderer(provider, function (err, renderer) {
            assert.ok(renderer, err);
            // This needs an existing pg user that can connect to
            // the database. Failure to connect would result in the
            // renderer not staying in the cache, as per
            // http://github.com/CartoDB/Windshaft/issues/171
            provider = createMapConfigProvider({
                dbuser: 'test_ws_publicuser',
                dbpassword: 'public'
            });

            renderCache.getRenderer(provider, function (/* err, renderer */) {
                renderCache.getRenderer(createMapConfigProvider({ token: mapConfig2.id() }), function () {
                    assert.equal(Object.keys(renderCache.renderers).length, 3);

                    renderCache.reset(provider);

                    assert.equal(
                        Object.keys(renderCache.renderers).length,
                        1,
                        Object.keys(renderCache.renderers).join('\n')
                    );

                    done();
                });
            });
        });
    });

    it('can purge all renderers', function (done) {
        var renderCache = makeRenderCache();

        var provider = createMapConfigProvider();
        renderCache.getRenderer(provider, function (err, renderer) {
            assert.ok(renderer, err);
            provider = createMapConfigProvider({ scale_factor: 2 });

            renderCache.getRenderer(provider, function (/* err, renderer */) {
                provider = createMapConfigProvider({ token: mapConfig2.id() });

                renderCache.getRenderer(provider, function (/* err, renderer */) {
                    assert.equal(Object.keys(renderCache.renderers).length, 3);

                    renderCache.purge();

                    assert.equal(Object.keys(renderCache.renderers).length, 0);

                    done();
                });
            });
        });
    });

    it('automatically deletes tilelive only after timeout', function (done) {
        var renderCache = makeRenderCache({ timeout: 100 });

        var provider = createMapConfigProvider();
        renderCache.getRenderer(provider, function (err, renderer) {
            assert.ok(renderer, err);
            assert.equal(Object.keys(renderCache.renderers).length, 1);

            setTimeout(function () {
                assert.equal(Object.keys(renderCache.renderers).length, 0);
                done();
            }, 200);
        });
    });

    // Remove from cache renderers erroing out
    // See https://github.com/CartoDB/Windshaft/issues/171
    it('does not keep erroring renderers in cache', function (done) {
        var renderCache = makeRenderCache();
        assert.equal(Object.keys(renderCache.renderers).length, 0);
        var provider = createMapConfigProvider({ token: 'nonexistant' });
        renderCache.getRenderer(provider, function (err/*, renderer */) {
            assert.ok(err);
            // Need next tick as the renderer is removed from
            // the cache after the callback is invoked
            setTimeout(function () {
                err = null;
                try {
                    assert.equal(Object.keys(renderCache.renderers).length, 0);
                } catch (e) { err = e; }
                done(err);
            }, 0);
        });
    });

    it('does not keep renderers in cache for unexistent tokes', function (done) {
        var renderCache = makeRenderCache();
        assert.equal(Object.keys(renderCache.renderers).length, 0);
        var provider = createMapConfigProvider({ token: 'wadus' });
        renderCache.getRenderer(provider, function (err/*, renderer */) {
            assert.ok(err);
            assert.equal(Object.keys(renderCache.renderers).length, 0);
            done();
        });
    });
});
