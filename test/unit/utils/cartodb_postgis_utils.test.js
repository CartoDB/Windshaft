'use strict';

const assert = require('assert');
const CartoDBPostgisUtils = require('../../../lib/windshaft/utils/cartodb_postgis_utils');


describe('cartodb-postgresql utils', function () {

    it('cdbXYZResolution works with integer', function () {
        const pgUtils = new CartoDBPostgisUtils();

        assert.equal(pgUtils.cdbXYZResolution(0), 156543.03392804097);
        assert.equal(pgUtils.cdbXYZResolution(1), 78271.51696402048);
        assert.equal(pgUtils.cdbXYZResolution(4), 9783.93962050256);
        assert.equal(pgUtils.cdbXYZResolution(6), 2445.98490512564);
        assert.equal(pgUtils.cdbXYZResolution(18), 0.5971642834779395);
        assert.equal(pgUtils.cdbXYZResolution(24), 0.009330691929342804);
        assert.equal(pgUtils.cdbXYZResolution(30), 0.00014579206139598132);
        assert.equal(pgUtils.cdbXYZResolution(32), 0.00003644801534899533);
    });

    it('cdbXYZResolution throws on invalid values', function () {
        const pgUtils = new CartoDBPostgisUtils();

        assert.throws(() => pgUtils.cdbXYZResolution(1.0001));
        assert.throws(() => pgUtils.cdbXYZResolution(-3));
        assert.throws(() => pgUtils.cdbXYZResolution(-2.99));
        assert.throws(() => pgUtils.cdbXYZResolution('dasd'));
    });


});
