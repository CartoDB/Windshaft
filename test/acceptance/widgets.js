require('../support/test_helper');

var assert        = require('../support/assert');
var TestClient = require('../support/test_client');

describe('widgets', function() {

    describe('lists', function() {

        var listsMapConfig = {
            version: '1.5.0',
            layers: [
                {
                    type: 'mapnik',
                    options: {
                        sql: 'select * from test_table',
                        cartocss: '#layer0 { marker-fill: red; marker-width: 10; }',
                        cartocss_version: '2.0.1',
                        widgets: {
                            places: {
                                type: 'list',
                                options: {
                                    columns: ['name', 'address']
                                }
                            }
                        }
                    }
                }
            ]
        };

        it('cannot be fetched from nonexistent list name', function(done) {
            var testClient = new TestClient(listsMapConfig);
            testClient.getWidget(0, 'nonexistent', function (err) {
                assert.ok(err);
                assert.equal(err.message, "Widget 'nonexistent' not found at layer 0");
                done();
            });
        });

        it('can be fetched from a valid list', function(done) {
            var testClient = new TestClient(listsMapConfig);
            testClient.getWidget(0, 'places', function (err, list) {
                assert.ok(!err, err);
                assert.ok(list);
                assert.equal(list.length, 5);

                var expectedNames = ['Hawai', 'El Estocolmo', 'El Rey del Tallarín', 'El Lacón', 'El Pico'];
                var names = list.map(function (item) {
                    return item.name;
                });
                assert.deepEqual(names, expectedNames);

                done();
            });
        });

    });

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

                assert.ok(histogram.length);

                assert.deepEqual(histogram[0], { bucket: 0, buckets: 10, min: 1, max: 1, freq: 179 });

                done();
            });
        });

        it('can be fetched from a valid histogram', function(done) {
            var testClient = new TestClient(histogramsMapConfig);
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

        it('returns array with undefined entries for empty bins', function(done) {
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
                                        column: 'pop_max',
                                        bins: 20
                                    }
                                }
                            }
                        }
                    }
                ]
            };

            var testClient = new TestClient(histogram20binsMapConfig);
            testClient.getWidget(0, 'pop_max', function (err, histogram) {
                assert.ok(!err, err);
                assert.ok(histogram);

                assert.ok(histogram.length);

                assert.deepEqual(
                    histogram[histogram.length - 1],
                    { bucket: 19, buckets: 20, min: 35676000, max: 35676000, freq: 1 }
                );

                assert.ok(!histogram[histogram.length - 2]);

                done();
            });
        });

    });


});
