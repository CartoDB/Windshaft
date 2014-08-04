var   _             = require('underscore')
    , th            = require('../support/test_helper.js')
    , assert        = require('assert')
    , CacheEntry   = require('../../lib/windshaft/cache/cache_entry.js')
    , grainstore    = require('grainstore')
    , RenderCache   = require('../../lib/windshaft/render_cache.js')
    , serverOptions = require('../support/server_options')
    , tests         = module.exports = {};

suite('cache_buster', function() {

    var mmlStore  = new grainstore.MMLStore(serverOptions.redis, serverOptions.grainstore),
        renderCache = new RenderCache(10000, mmlStore),
        NAN_CACHE_BUSTER_ID = 'foo_id',
        NAN_CACHE_BUSTER_OTHER_ID = 'bar_id',
        CACHE_BUSTER_OLDER = 1111111,
        CACHE_BUSTER       = 5555555,
        CACHE_BUSTER_NEWER = 9999999,
        ONE_DAY_IN_MILISECONDS = 86400 * 1000;

    test('renderer is recreated when buster is NaN and not equal to cached one', function () {
        var cacheEntry = new CacheEntry();
        cacheEntry.cache_buster = NAN_CACHE_BUSTER_ID;

        assert.equal(
            renderCache.shouldRecreateRenderer(cacheEntry, NAN_CACHE_BUSTER_OTHER_ID),
            true,
            "It SHOULD recreate the renderer for the same NaN buster"
        );
    });

    test('renderer is NOT recreated when buster is NaN and equals to cached one', function () {
        var cacheEntry = new CacheEntry();
        cacheEntry.cache_buster = NAN_CACHE_BUSTER_ID;

        assert.equal(
            renderCache.shouldRecreateRenderer(cacheEntry, NAN_CACHE_BUSTER_ID),
            false,
            "It should NOT recreate the renderer for the same NaN buster"
        );
    });

    test('renderer is recreated when buster is a number and bigger than cached one', function () {
        var cacheEntry = new CacheEntry();
        cacheEntry.cache_buster = CACHE_BUSTER;

        assert.equal(
            renderCache.shouldRecreateRenderer(cacheEntry, CACHE_BUSTER_NEWER),
            true,
            "It SHOULD recreate the renderer for a bigger cache buster numeric value"
        );
    });

    test('renderer is NOT recreated when buster is a number and equal than cached one', function () {
        var cacheEntry = new CacheEntry();
        cacheEntry.cache_buster = CACHE_BUSTER;

        assert.equal(
            renderCache.shouldRecreateRenderer(cacheEntry, CACHE_BUSTER),
            false,
            "It should NOT recreate the renderer for the same cache buster numeric value"
        );
    });

    test('renderer is NOT recreated when buster is a number and equal than cached one', function () {
        var cacheEntry = new CacheEntry();
        cacheEntry.cache_buster = CACHE_BUSTER;

        assert.equal(
            renderCache.shouldRecreateRenderer(cacheEntry, CACHE_BUSTER_OLDER),
            false,
            "It should NOT recreate the renderer for the same cache buster numeric value"
        );
    });

    test('renderer is (re)created when it is undefined', function () {
        var cacheEntry = undefined;

        assert.equal(
            renderCache.shouldRecreateRenderer(cacheEntry, CACHE_BUSTER),
            true,
            "It SHOULD (re)create the renderer when it is undefined"
        );
    });

    test('renderer cache is set to param one if is numeric and not too far in the future', function() {
        var now = Date.now();
        renderCache._getMaxCacheBusterValue = function() {
            return now;
        };
        var inThePastCacheBuster = now - ONE_DAY_IN_MILISECONDS;

        var cacheBuster = renderCache.getCacheBusterValue(inThePastCacheBuster);

        assert.equal(cacheBuster, inThePastCacheBuster);
    });

    test('renderer cache is not set far in the future when using number cache buster', function() {
        var now = Date.now();
        renderCache._getMaxCacheBusterValue = function() {
            return now;
        };
        var farInTheFutureCacheBuster = now + (5 * ONE_DAY_IN_MILISECONDS);

        var cacheBuster = renderCache.getCacheBusterValue(farInTheFutureCacheBuster);

        assert.equal(cacheBuster, now);
    });

    test('value for cache buster is original when is not number', function() {
        var cacheBusterParamValue = 'test';
        var cacheBuster = renderCache.getCacheBusterValue(cacheBusterParamValue);

        assert.equal(cacheBuster, cacheBusterParamValue);
    });
});
