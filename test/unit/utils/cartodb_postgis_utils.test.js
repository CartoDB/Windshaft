'use strict';

const assert = require('assert');
const CartoDBPostgisUtils = require('../../../lib/windshaft/utils/cartodb_postgis_utils');


describe('cartodb-postgresql utils', function () {

    it('cdbXYZResolution works with integer', function () {
        const pgUtils = new CartoDBPostgisUtils();

        assert.equal(pgUtils.cdbXYZResolution(0),  "156543.03392804097656");
        assert.equal(pgUtils.cdbXYZResolution(1),  "78271.51696402048828");
        assert.equal(pgUtils.cdbXYZResolution(4),  "9783.939620502561035");
        assert.equal(pgUtils.cdbXYZResolution(6),  "2445.9849051256402588");
        assert.equal(pgUtils.cdbXYZResolution(18), "0.5971642834779395163");
        assert.equal(pgUtils.cdbXYZResolution(24), "0.0093306919293428049421");
        assert.equal(pgUtils.cdbXYZResolution(30), "0.00014579206139598132722");
        assert.equal(pgUtils.cdbXYZResolution(32), "0.000036448015348995331805");
    });

    it('cdbXYZResolution throws on invalid values', function () {
        const pgUtils = new CartoDBPostgisUtils();

        assert.throws(() => pgUtils.cdbXYZResolution(1.0001));
        assert.throws(() => pgUtils.cdbXYZResolution(-3));
        assert.throws(() => pgUtils.cdbXYZResolution(-2.99));
        assert.throws(() => pgUtils.cdbXYZResolution('dasd'));
    });

    it('cdbXYZExtent works with integer', function () {
        const pgUtils = new CartoDBPostgisUtils();

        let extent = pgUtils.cdbXYZExtent(0, 0, 0);
        assert.equal(extent.xmin, "-20037508.342789245");
        assert.equal(extent.ymin, "-20037508.342789245");
        assert.equal(extent.xmax, "20037508.342789245");
        assert.equal(extent.ymax, "20037508.342789245");

        extent = pgUtils.cdbXYZExtent(0, 0, 18);
        assert.equal(extent.xmin, "-20037508.342789245");
        assert.equal(extent.ymin, "20037355.468732674647");
        assert.equal(extent.xmax, "-20037355.468732674647");
        assert.equal(extent.ymax, "20037508.342789245");

        extent = pgUtils.cdbXYZExtent(0, 0, 20);
        assert.equal(extent.xmin, "-20037508.342789245");
        assert.equal(extent.ymin, "20037470.124275102412");
        assert.equal(extent.xmax, "-20037470.124275102412");
        assert.equal(extent.ymax, "20037508.342789245");


        extent = pgUtils.cdbXYZExtent(1208, 1539, 12);
        assert.equal(extent.xmin, "-8218509.281222151269");
        assert.equal(extent.ymin, "4970241.327215301006");
        assert.equal(extent.xmax, "-8208725.341601648708");
        assert.equal(extent.ymax, "4980025.266835803567");

        extent = pgUtils.cdbXYZExtent(603, 670, 11);
        assert.equal(extent.xmin, "-8238077.160463156392");
        assert.equal(extent.ymin, "6907461.3720748080909");
        assert.equal(extent.xmax, "-8218509.2812221512699");
        assert.equal(extent.ymax, "6927029.251315813213");
    });

    it('cdbXYZExtent boundaries around 0,0 (zoom 1)', function () {
        const pgUtils = new CartoDBPostgisUtils();

        let extent = pgUtils.cdbXYZExtent(0, 0, 1);
        assert.equal(extent.xmin, "-20037508.342789245");
        assert.equal(extent.ymin, "0");
        assert.equal(extent.xmax, "0");
        assert.equal(extent.ymax, "20037508.342789245");

        extent = pgUtils.cdbXYZExtent(0, 1, 1);
        assert.equal(extent.xmin, "-20037508.342789245");
        assert.equal(extent.ymin, "-20037508.342789245");
        assert.equal(extent.xmax, "0");
        assert.equal(extent.ymax, "0");

        extent = pgUtils.cdbXYZExtent(1, 0, 1);
        assert.equal(extent.xmin, "0");
        assert.equal(extent.ymin, "0");
        assert.equal(extent.xmax, "20037508.342789245");
        assert.equal(extent.ymax, "20037508.342789245");

        extent = pgUtils.cdbXYZExtent(1, 1, 1);
        assert.equal(extent.xmin, "0");
        assert.equal(extent.ymin, "-20037508.342789245");
        assert.equal(extent.xmax, "20037508.342789245");
        assert.equal(extent.ymax, "0");
    });

    it('cdbXYZExtent boundaries around 0,0 (zoom 3)', function () {
        const pgUtils = new CartoDBPostgisUtils();

        let extent = pgUtils.cdbXYZExtent(3, 3, 3);
        assert.equal(extent.xmin, "-5009377.08569731125");
        assert.equal(extent.ymin, "0");
        assert.equal(extent.xmax, "0");
        assert.equal(extent.ymax, "5009377.08569731125");

        extent = pgUtils.cdbXYZExtent(3, 4, 3);
        assert.equal(extent.xmin, "-5009377.08569731125");
        assert.equal(extent.ymin, "-5009377.08569731125");
        assert.equal(extent.xmax, "0");
        assert.equal(extent.ymax, "0");

        extent = pgUtils.cdbXYZExtent(4, 3, 3);
        assert.equal(extent.xmin, "0");
        assert.equal(extent.ymin, "0");
        assert.equal(extent.xmax, "5009377.08569731125");
        assert.equal(extent.ymax, "5009377.08569731125");

        extent = pgUtils.cdbXYZExtent(4, 4, 3);
        assert.equal(extent.xmin, "0");
        assert.equal(extent.ymin, "-5009377.08569731125");
        assert.equal(extent.xmax, "5009377.08569731125");
        assert.equal(extent.ymax, "0");
    });

    it('cdbXYZExtent throws with invalid tiles', function () {
        const pgUtils = new CartoDBPostgisUtils();

        assert.throws(() => pgUtils.cdbXYZExtent(0, 2, 0));
        assert.throws(() => pgUtils.cdbXYZExtent(2, 0, 0));
    });

    it('cdbXYZExtent throws on invalid values', function () {
        const pgUtils = new CartoDBPostgisUtils();

        assert.throws(() => pgUtils.cdbXYZExtent());
        assert.throws(() => pgUtils.cdbXYZExtent(-1, 0, 0));
        assert.throws(() => pgUtils.cdbXYZExtent(-2.99));
        assert.throws(() => pgUtils.cdbXYZExtent('dasd'));
    });
});
