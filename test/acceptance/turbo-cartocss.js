require('../support/test_helper');

var assert = require('../support/assert');
var TestClient = require('../support/test_client');

var IMAGE_EQUALS_TOLERANCE_PER_MIL = 10;

function imageCompareFn(fixture, done) {
    return function(err, tile) {
        if (err) {
            return done(err);
        }
        assert.imageEqualsFile(tile, './test/fixtures/' + fixture, IMAGE_EQUALS_TOLERANCE_PER_MIL, done);
    };
}

describe('turbo-cartocss', function() {
    describe('parsing ramp function with colorbrewer for greens', function () {
        before(function (done) {
            this.testClient = new TestClient({
                "version": "1.4.0",
                "layers": [
                    {
                        "type": 'mapnik',
                        "options": {
                            "cartocss_version": '2.3.0',
                            "sql": "select * from test_table",
                            "cartocss": '#layer { marker-fill: ramp([price], colorbrewer(Greens), jenks); }'
                        }
                    }
                ]
            });

            this.testClient.createLayergroup(done);
        });

        it('should get a tile with turbo-cartocss parsed properly', function (done) {
            this.testClient.getTile(13, 4011, 3088,
                imageCompareFn('test_turbo_cartocss_greens_13_4011_3088.png', done));
        });
    });

    describe('parsing ramp function with colorbrewer for reds', function () {

        before(function (done) {
            this.testClient = new TestClient({
                "version": "1.4.0",
                "layers": [
                    {
                        "type": 'mapnik',
                        "options": {
                            "cartocss_version": '2.3.0',
                            "sql": "select * from test_table",
                            "cartocss": '#layer { marker-fill: ramp([price], colorbrewer(Greens), jenks); }'
                        }
                    }
                ]
            });

            this.testClient.createLayergroup(done);
        });

        it('should get a tile with turbo-cartocss parsed properly', function (done) {
            this.testClient.getTile(13, 4011, 3088,
                imageCompareFn('test_turbo_cartocss_reds_13_4011_3088.png', done));
        });
    });
});
