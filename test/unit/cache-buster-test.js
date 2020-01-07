'use strict';

require('../support/test-helper');

var assert = require('assert');
var CacheEntry = require('../../lib/cache/cache-entry');
var RendererCache = require('../../lib/cache/renderer-cache');

describe('cache_buster', function () {
    var rendererCache = new RendererCache();
    var NAN_CACHE_BUSTER_ID = 'foo_id';
    var NAN_CACHE_BUSTER_OTHER_ID = 'bar_id';
    var CACHE_BUSTER_OLDER = 1111111;
    var CACHE_BUSTER = 5555555;
    var CACHE_BUSTER_NEWER = 9999999;
    var ONE_DAY_IN_MILISECONDS = 86400 * 1000;

    it('renderer is recreated when buster is NaN and not equal to cached one', function () {
        var cacheEntry = new CacheEntry(NAN_CACHE_BUSTER_ID);

        assert.equal(
            rendererCache.shouldRecreateRenderer(cacheEntry, NAN_CACHE_BUSTER_OTHER_ID),
            true,
            'It SHOULD recreate the renderer for the same NaN buster'
        );
    });

    it('renderer is NOT recreated when buster is NaN and equals to cached one', function () {
        var cacheEntry = new CacheEntry(NAN_CACHE_BUSTER_ID);

        assert.equal(
            rendererCache.shouldRecreateRenderer(cacheEntry, NAN_CACHE_BUSTER_ID),
            false,
            'It should NOT recreate the renderer for the same NaN buster'
        );
    });

    it('renderer is recreated when buster is a number and bigger than cached one', function () {
        var cacheEntry = new CacheEntry(CACHE_BUSTER);

        assert.equal(
            rendererCache.shouldRecreateRenderer(cacheEntry, CACHE_BUSTER_NEWER),
            true,
            'It SHOULD recreate the renderer for a bigger cache buster numeric value'
        );
    });

    it('renderer is NOT recreated when buster is a number and equal than cached one', function () {
        var cacheEntry = new CacheEntry(CACHE_BUSTER);

        assert.equal(
            rendererCache.shouldRecreateRenderer(cacheEntry, CACHE_BUSTER),
            false,
            'It should NOT recreate the renderer for the same cache buster numeric value'
        );
    });

    it('renderer is NOT recreated when buster is a number and equal than cached one', function () {
        var cacheEntry = new CacheEntry(CACHE_BUSTER);

        assert.equal(
            rendererCache.shouldRecreateRenderer(cacheEntry, CACHE_BUSTER_OLDER),
            false,
            'It should NOT recreate the renderer for the same cache buster numeric value'
        );
    });

    it('renderer is (re)created when it is undefined', function () {
        assert.equal(
            rendererCache.shouldRecreateRenderer(undefined, CACHE_BUSTER),
            true,
            'It SHOULD (re)create the renderer when it is undefined'
        );
    });

    it('renderer cache is set to param one if is numeric and not too far in the future', function () {
        var now = Date.now();
        rendererCache._getMaxCacheBusterValue = function () {
            return now;
        };
        var inThePastCacheBuster = now - ONE_DAY_IN_MILISECONDS;

        var cacheBuster = rendererCache.getCacheBusterValue(inThePastCacheBuster);

        assert.equal(cacheBuster, inThePastCacheBuster);
    });

    it('renderer cache is not set far in the future when using number cache buster', function () {
        var now = Date.now();
        rendererCache._getMaxCacheBusterValue = function () {
            return now;
        };
        var farInTheFutureCacheBuster = now + (5 * ONE_DAY_IN_MILISECONDS);

        var cacheBuster = rendererCache.getCacheBusterValue(farInTheFutureCacheBuster);

        assert.equal(cacheBuster, now);
    });

    it('value for cache buster is original when is not number', function () {
        var cacheBusterParamValue = 'test';
        var cacheBuster = rendererCache.getCacheBusterValue(cacheBusterParamValue);

        assert.equal(cacheBuster, cacheBusterParamValue);
    });
});
