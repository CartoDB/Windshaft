'use strict';

const assert = require('assert');
const WebMercatorHelper = require('../../../lib/windshaft/utils/webmercator_helper');


describe('cartodb-postgresql utils', function () {

    it('getResolution works with integer', function () {
        const wmh = new WebMercatorHelper();

        assert.equal(wmh.getResolution({ z : 0 }),  "156543.03392804097656");
        assert.equal(wmh.getResolution({ z : 1 }),  "78271.51696402048828");
        assert.equal(wmh.getResolution({ z : 4 }),  "9783.939620502561035");
        assert.equal(wmh.getResolution({ z : 6 }),  "2445.9849051256402588");
        assert.equal(wmh.getResolution({ z : 18 }), "0.5971642834779395163");
        assert.equal(wmh.getResolution({ z : 24 }), "0.0093306919293428049421");
        assert.equal(wmh.getResolution({ z : 30 }), "0.00014579206139598132722");
        assert.equal(wmh.getResolution({ z : 32 }), "0.000036448015348995331805");
    });

    it('getResolution throws on invalid values', function () {
        const wmh = new WebMercatorHelper();

        assert.throws(() => wmh.getResolution(1));
        assert.throws(() => wmh.getResolution({ z : 1.0001 }));
        assert.throws(() => wmh.getResolution({ z : -3 }));
        assert.throws(() => wmh.getResolution({ z : -2.99 }));
        assert.throws(() => wmh.getResolution({ z : 'dasd' }));
    });

    it('getExtent works with integer', function () {
        const wmh = new WebMercatorHelper();

        let extent = wmh.getExtent({ x : 0, y : 0, z : 0 });
        assert.equal(extent.xmin, "-20037508.342789245");
        assert.equal(extent.ymin, "-20037508.342789245");
        assert.equal(extent.xmax, "20037508.342789245");
        assert.equal(extent.ymax, "20037508.342789245");

        extent = wmh.getExtent({ x : 0, y : 0, z : 18 });
        assert.equal(extent.xmin, "-20037508.342789245");
        assert.equal(extent.ymin, "20037355.468732674647");
        assert.equal(extent.xmax, "-20037355.468732674647");
        assert.equal(extent.ymax, "20037508.342789245");

        extent = wmh.getExtent({ x : 0, y : 0, z : 20 });
        assert.equal(extent.xmin, "-20037508.342789245");
        assert.equal(extent.ymin, "20037470.124275102412");
        assert.equal(extent.xmax, "-20037470.124275102412");
        assert.equal(extent.ymax, "20037508.342789245");


        extent = wmh.getExtent({ x : 1208, y : 1539, z : 12 });
        assert.equal(extent.xmin, "-8218509.281222151269");
        assert.equal(extent.ymin, "4970241.327215301006");
        assert.equal(extent.xmax, "-8208725.341601648708");
        assert.equal(extent.ymax, "4980025.266835803567");

        extent = wmh.getExtent({ x : 603, y : 670, z : 11 });
        assert.equal(extent.xmin, "-8238077.160463156392");
        assert.equal(extent.ymin, "6907461.3720748080909");
        assert.equal(extent.xmax, "-8218509.2812221512699");
        assert.equal(extent.ymax, "6927029.251315813213");
    });

    it('getExtent boundaries around 0,0 (zoom 1)', function () {
        const wmh = new WebMercatorHelper();

        let extent = wmh.getExtent({ x : 0, y : 0, z : 1 });
        assert.equal(extent.xmin, "-20037508.342789245");
        assert.equal(extent.ymin, "0");
        assert.equal(extent.xmax, "0");
        assert.equal(extent.ymax, "20037508.342789245");

        extent = wmh.getExtent({ x : 0, y : 1, z : 1 });
        assert.equal(extent.xmin, "-20037508.342789245");
        assert.equal(extent.ymin, "-20037508.342789245");
        assert.equal(extent.xmax, "0");
        assert.equal(extent.ymax, "0");

        extent = wmh.getExtent({ x : 1, y : 0, z : 1 });
        assert.equal(extent.xmin, "0");
        assert.equal(extent.ymin, "0");
        assert.equal(extent.xmax, "20037508.342789245");
        assert.equal(extent.ymax, "20037508.342789245");

        extent = wmh.getExtent({ x : 1, y : 1, z : 1 });
        assert.equal(extent.xmin, "0");
        assert.equal(extent.ymin, "-20037508.342789245");
        assert.equal(extent.xmax, "20037508.342789245");
        assert.equal(extent.ymax, "0");
    });

    it('getExtent boundaries around 0,0 (zoom 3)', function () {
        const wmh = new WebMercatorHelper();

        let extent = wmh.getExtent({ x : 3, y : 3, z : 3 });
        assert.equal(extent.xmin, "-5009377.08569731125");
        assert.equal(extent.ymin, "0");
        assert.equal(extent.xmax, "0");
        assert.equal(extent.ymax, "5009377.08569731125");

        extent = wmh.getExtent({ x : 3, y : 4, z : 3 });
        assert.equal(extent.xmin, "-5009377.08569731125");
        assert.equal(extent.ymin, "-5009377.08569731125");
        assert.equal(extent.xmax, "0");
        assert.equal(extent.ymax, "0");

        extent = wmh.getExtent({ x : 4, y : 3, z : 3 });
        assert.equal(extent.xmin, "0");
        assert.equal(extent.ymin, "0");
        assert.equal(extent.xmax, "5009377.08569731125");
        assert.equal(extent.ymax, "5009377.08569731125");

        extent = wmh.getExtent({ x : 4, y : 4, z : 3 });
        assert.equal(extent.xmin, "0");
        assert.equal(extent.ymin, "-5009377.08569731125");
        assert.equal(extent.xmax, "5009377.08569731125");
        assert.equal(extent.ymax, "0");
    });

    it('getExtent throws with invalid tiles', function () {
        const wmh = new WebMercatorHelper();

        assert.throws(() => wmh.getExtent({ x : 0, y : 2, z : 0 }));
        assert.throws(() => wmh.getExtent({ x : 2, y : 0, z : 0 }));
    });

    it('getExtent throws on invalid values', function () {
        const wmh = new WebMercatorHelper();

        assert.throws(() => wmh.getExtent());
        assert.throws(() => wmh.getExtent(0, 0, 0));
        assert.throws(() => wmh.getExtent({ x : -1, y : 0, z : 0 }));
        assert.throws(() => wmh.getExtent(-2.99));
        assert.throws(() => wmh.getExtent('dasd'));
    });
});
