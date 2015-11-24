require('../../support/test_helper');

var assert        = require('../../support/assert');
var TestClient = require('../../support/test_client');

describe('widgets', function() {

    describe('histograms', function() {

        var histogramsMapConfig = {
            version: '1.5.0',
            layers: [
                {
                    type: 'mapnik',
                    options: {
                        sql: 'select * from populated_places_simple_reduced',
                        cartocss: '#layer0 { marker-fill: red; marker-width: 10; }',
                        cartocss_version: '2.0.1',
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
                }
            ]
        };

        it('can be fetched from a valid histogram', function(done) {
            var testClient = new TestClient(histogramsMapConfig);
            testClient.getWidget(0, 'scalerank', function (err, histogram) {
                assert.ok(!err, err);
                assert.ok(histogram);
                assert.equal(histogram.type, 'histogram');
                validateHistogramBins(histogram);

                assert.ok(histogram.bins.length);

                assert.deepEqual(histogram.bins[0], { bin: 0, freq: 179, min: 1, max: 1 });

                done();
            });
        });

        it('can be fetched from a valid histogram', function(done) {
            var testClient = new TestClient(histogramsMapConfig);
            testClient.getWidget(0, 'pop_max', function (err, histogram) {
                assert.ok(!err, err);
                assert.ok(histogram);
                assert.equal(histogram.type, 'histogram');
                validateHistogramBins(histogram);

                assert.ok(histogram.bins.length);

                assert.deepEqual(
                    histogram.bins[histogram.bins.length - 1],
                    { bin: 47, freq: 1, min: 35676000, max: 35676000 }
                );

                done();
            });
        });

        it('returns array with freq=0 entries for empty bins', function(done) {
            var histogram20binsMapConfig = {
                version: '1.5.0',
                layers: [
                    {
                        type: 'mapnik',
                        options: {
                            sql: 'select * from populated_places_simple_reduced',
                            cartocss: '#layer0 { marker-fill: red; marker-width: 10; }',
                            cartocss_version: '2.0.1',
                            widgets: {
                                pop_max: {
                                    type: 'histogram',
                                    options: {
                                        column: 'pop_max'
                                    }
                                }
                            }
                        }
                    }
                ]
            };

            var testClient = new TestClient(histogram20binsMapConfig);
            testClient.getWidget(0, 'pop_max', { start: 0, end: 35676000, bins: 20 }, function (err, histogram) {
                assert.ok(!err, err);
                assert.equal(histogram.type, 'histogram');
                validateHistogramBins(histogram);
                assert.ok(histogram.bins.length);
                assert.deepEqual(
                    histogram.bins[histogram.bins.length - 1],
                    { bin: 19, freq: 1, min: 35676000, max: 35676000 }
                );

                var emptyBin = histogram.bins[18];
                assert.ok(!emptyBin);

                done();
            });
        });

        function validateHistogramBins(histogram) {
            var binWidth = histogram.bin_width;
            var start = histogram.bins_start;
            var end = start + (histogram.bins_count * binWidth);

            var firstBin = histogram.bins[0];
            assert.equal(firstBin.min, start,
                'First bin does not match min and start ' + JSON.stringify({
                    min: firstBin.min,
                    start: start
                })
            );

            var lastBin = histogram.bins[histogram.bins.length - 1];
            assert.equal(lastBin.max, end,
                'Last bin does not match max and end ' + JSON.stringify({
                    max: lastBin.max,
                    end: end
                })
            );

            function getBinStartEnd(binIndex) {
                return {
                    start: start + (binIndex * binWidth),
                    end: start + ((binIndex + 1) * binWidth)
                };
            }

            histogram.bins.forEach(function(bin) {
                var binStartEnd = getBinStartEnd(bin.bin);

                assert.ok(binStartEnd.start <= bin.min,
                    'Bin start bigger than bin min ' + JSON.stringify({
                        bin: bin.bin,
                        min: bin.min,
                        start: binStartEnd.start
                    })
                );

                assert.ok(binStartEnd.end >= bin.max,
                    'Bin end smaller than bin max ' + JSON.stringify({
                        bin: bin.bin,
                        max: bin.max,
                        end: binStartEnd.end
                    })
                );
            });
        }

    });

});
