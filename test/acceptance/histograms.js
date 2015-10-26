require('../support/test_helper');

var assert        = require('../support/assert');
var TestClient = require('../support/test_client');

describe('histograms', function() {

    var listsMapConfig = {
        version: '1.5.0',
        layers: [
            {
                type: 'mapnik',
                options: {
                    sql: 'select * from populated_places_simple_reduced',
                    cartocss: '#layer0 { marker-fill: red; marker-width: 10; }',
                    cartocss_version: '2.0.1'
                },
                widgets: {
                    scalerank: {
                        type: 'histogram',
                        options: {
                            column: 'scalerank'
                        }
                    },
                    pop_max: {
                        type: 'histogram',
                        options: {
                            column: 'pop_max'
                        }
                    }
                }
            }
        ]
    };

    it('can be fetched from a valid histogram', function(done) {
        var testClient = new TestClient(listsMapConfig);
        testClient.getWidget(0, 'scalerank', function (err, histogram) {
            assert.ok(!err, err);
            assert.ok(histogram);

            assert.ok(histogram.length);

            assert.deepEqual(histogram[0], { bucket: 0, buckets: 10, min: 1, max: 1, freq: 179 });

            done();
        });
    });

    it('can be fetched from a valid histogram', function(done) {
        var testClient = new TestClient(listsMapConfig);
        testClient.getWidget(0, 'pop_max', function (err, histogram) {
            assert.ok(!err, err);
            assert.ok(histogram);

            assert.ok(histogram.length);

            assert.deepEqual(
                histogram[histogram.length - 1],
                { bucket: 9, buckets: 10, min: 35676000, max: 35676000, freq: 1 }
            );

            done();
        });
    });

});
