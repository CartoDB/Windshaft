require('../../support/test_helper.js');
var util = require('util');

var assert = require('../../support/assert');
var BboxFilter = require('../../../lib/windshaft/models/filters/bbox');

var MAX_EXTENT_MERCATOR_REF = [
    -BboxFilter.LONGITUDE_MAX_VALUE,
    -BboxFilter.LATITUDE_MAX_VALUE,
    BboxFilter.LONGITUDE_MAX_VALUE,
    BboxFilter.LATITUDE_MAX_VALUE
];

describe('Bounding box filter', function() {

    describe('wrap longitude', function() {
        var longitudesScenarios = [
            [[0, 90], [0, 90]],
            [[-90, 0], [-90, 0]],
            [[-90, 90], [-90, 90]],
            [[-990, -720], [90, 360]],
            [[810, 1080], [90, 360]],
            [[-180, 180], [-180, 180]]
        ];

        longitudesScenarios.forEach(function(scenario) {
            it(util.format('should adjust from %j to %j', scenario[0], scenario[1]), function() {
                var we = BboxFilter.adjustLongitudeRange(scenario[0]);

                assert.equal(
                    we[0], scenario[1][0],
                    util.format('west, got %d, expected %d, scenario: %s',
                        we[1], scenario[1][1], JSON.stringify(scenario)
                    )
                );
                assert.equal(
                    we[1], scenario[1][1],
                    util.format('east, got %d, expected %d, scenario: %s',
                        we[1], scenario[1][1], JSON.stringify(scenario)
                    )
                );
            });
        });
    });

    function createFilter(bbox) {
        return new BboxFilter({}, { bbox: bbox.join(',') });
    }

    function createRef(bbox) {
        return bbox;
//        return mercator.forward([bbox[0], bbox[1]]).concat(mercator.forward([bbox[2], bbox[3]]));
    }


    it('happy case', function() {
        var bbox = [-90, -45, 90, 45];
        var bboxFilter = createFilter(bbox);
        assert.equal(bboxFilter.bboxes.length, 1);
        assert.deepEqual(bboxFilter.bboxes[0], createRef(bbox));
    });

    describe('latitude', function() {
        it('(hardcoded) clipping out of bounds', function() {
            var bbox = [-180, -90, 180, 90];
            var bboxFilter = createFilter(bbox);
            assert.equal(bboxFilter.bboxes.length, 1);
            assert.deepEqual(bboxFilter.bboxes[0], MAX_EXTENT_MERCATOR_REF);
        });

        it('clipping out of bounds', function() {
            var bbox = [-180, -90, 180, 90];
            var bboxFilter = createFilter(bbox);
            assert.equal(bboxFilter.bboxes.length, 1);
            assert.deepEqual(
                bboxFilter.bboxes[0],
                createRef([-180, -BboxFilter.LATITUDE_MAX_VALUE, 180, BboxFilter.LATITUDE_MAX_VALUE])
            );
        });
    });

    describe('longitude', function() {
        it('generating multiple bbox for east out of bounds', function() {
            var bbox = [90, -45, 360, 45];
            var bboxFilter = createFilter(bbox);

            assert.equal(bboxFilter.bboxes.length, 2, JSON.stringify([bboxFilter.bboxes, bbox]));

            assert.deepEqual(
                bboxFilter.bboxes[0],
                createRef([90, -45, 180, 45])
            );
            assert.deepEqual(
                bboxFilter.bboxes[1],
                createRef([-180, -45, 0, 45])
            );
        });

        it('generating multiple bbox for east out of bounds', function() {
            var bbox = [-270, -45, 0, 45];
            var bboxFilter = createFilter(bbox);

            assert.equal(bboxFilter.bboxes.length, 2);

            assert.deepEqual(
                bboxFilter.bboxes[0],
                createRef([90, -45, 180, 45])
            );
            assert.deepEqual(
                bboxFilter.bboxes[1],
                createRef([-180, -45, 0, 45])
            );
        });
    });

    describe('out of bounds', function() {
        it('wraps longitude', function () {
            var bbox = [-190, -45, 190, 45];
            var bboxFilter = createFilter(bbox);

            assert.equal(bboxFilter.bboxes.length, 1);

            assert.deepEqual(
                bboxFilter.bboxes[0],
                createRef([-180, -45, 180, 45])
            );
        });
    });
});
