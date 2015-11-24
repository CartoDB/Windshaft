require('../../support/test_helper');

var assert        = require('../../support/assert');
var TestClient = require('../../support/test_client');

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
                assert.equal(list.type, 'list');
                assert.equal(list.rows.length, 5);

                var expectedNames = ['Hawai', 'El Estocolmo', 'El Rey del Tallarín', 'El Lacón', 'El Pico'];
                var names = list.rows.map(function (item) {
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

    describe('aggregations', function() {

        var aggregationMapConfig = {
            version: '1.5.0',
            layers: [
                {
                    type: 'mapnik',
                    options: {
                        sql: 'select * from populated_places_simple_reduced',
                        cartocss: '#layer0 { marker-fill: red; marker-width: 10; }',
                        cartocss_version: '2.0.1',
                        widgets: {
                            adm0name: {
                                type: 'aggregation',
                                options: {
                                    column: 'adm0name',
                                    aggregation: 'count'
                                }
                            }
                        }
                    }
                }
            ]
        };

        it('can be fetched from a valid aggregation', function(done) {
            var testClient = new TestClient(aggregationMapConfig);
            testClient.getWidget(0, 'adm0name', function (err, aggregation) {
                assert.ok(!err, err);
                assert.ok(aggregation);
                assert.equal(aggregation.type, 'aggregation');

                assert.equal(aggregation.categories.length, 6);

                assert.deepEqual(
                    aggregation.categories[0],
                    { category: 'United States of America', value: 769, agg: false }
                );

                assert.deepEqual(
                    aggregation.categories[aggregation.categories.length - 1],
                    { category: 'Other', value: 4914, agg: true }
                );

                done();
            });
        });

        var filteredCategoriesScenarios = [
            { accept: ['Canada'], values: [256] },
            { accept: ['Canada', 'Spain', 'Chile', 'Thailand'], values: [256, 49, 83, 79] },
            { accept: ['Canada', 'Spain', 'Chile', 'Thailand', 'Japan'], values: [256, 49, 83, 79, 69] },
            { accept: ['Canada', 'Spain', 'Chile', 'Thailand', 'Japan', 'France'], values: [256, 49, 83, 79, 69, 71] },
            {
                accept: ['United States of America', 'Canada', 'Spain', 'Chile', 'Thailand', 'Japan', 'France'],
                values: [769, 256, 49, 83, 79, 69, 71]
            }
        ];

        filteredCategoriesScenarios.forEach(function(scenario) {
            it('can filter some categories: ' + scenario.accept.join(', '), function(done) {
                var testClient = new TestClient(aggregationMapConfig);
                var adm0nameFilter = {
                    adm0name: {
                        accept: scenario.accept
                    }
                };
                testClient.setLayersFiltersParams([adm0nameFilter]);
                testClient.getWidget(0, 'adm0name', { own_filter: 1 }, function (err, aggregation) {
                    assert.ok(!err, err);
                    assert.ok(aggregation);
                    assert.equal(aggregation.type, 'aggregation');

                    assert.equal(aggregation.categories.length, scenario.accept.length);

                    var categoriesByCategory = aggregation.categories.reduce(function(byCategory, row) {
                        byCategory[row.category] = row;
                        return byCategory;
                    }, {});

                    var scenarioByCategory = scenario.accept.reduce(function(byCategory, category, index) {
                        byCategory[category] = { category: category, value: scenario.values[index], agg: false };
                        return byCategory;
                    }, {});

                    Object.keys(categoriesByCategory).forEach(function(category) {
                        assert.deepEqual(categoriesByCategory[category], scenarioByCategory[category]);
                    });

                    done();
                });
            });
        });

        var aggregationSumMapConfig = {
            version: '1.5.0',
            layers: [
                {
                    type: 'mapnik',
                    options: {
                        sql: 'select * from populated_places_simple_reduced',
                        cartocss: '#layer0 { marker-fill: red; marker-width: 10; }',
                        cartocss_version: '2.0.1',
                        widgets: {
                            adm0name: {
                                type: 'aggregation',
                                options: {
                                    column: 'adm0name',
                                    aggregation: 'sum',
                                    aggregationColumn: 'pop_max'
                                }
                            }
                        }
                    }
                }
            ]
        };

        it('can sum other column for aggregation value', function(done) {

            var testClient = new TestClient(aggregationSumMapConfig);
            testClient.getWidget(0, 'adm0name', function (err, aggregation) {
                assert.ok(!err, err);
                assert.ok(aggregation);
                assert.equal(aggregation.type, 'aggregation');

                assert.equal(aggregation.categories.length, 6);

                assert.deepEqual(
                    aggregation.categories[0],
                    { category: 'China', value: 374537585, agg: false }
                );

                assert.deepEqual(
                    aggregation.categories[aggregation.categories.length - 1],
                    { category: 'Other', value: 1412626289, agg: true }
                );

                done();
            });
        });

        var filteredCategoriesSumScenarios = [
            { accept: ['Canada'], values: [23955084] },
            { accept: ['Canada', 'Spain', 'Chile', 'Thailand'], values: [23955084, 22902774, 14356263, 17492483] },
            {
                accept: ['United States of America', 'Canada', 'Spain', 'Chile', 'Thailand', 'Japan', 'France'],
                values: [239098994, 23955084, 22902774, 14356263, 17492483, 93577001, 25473876]
            }
        ];

        filteredCategoriesSumScenarios.forEach(function(scenario) {
            it('can filter some categories with sum aggregation: ' + scenario.accept.join(', '), function(done) {
                var testClient = new TestClient(aggregationSumMapConfig);
                var adm0nameFilter = {
                    adm0name: {
                        accept: scenario.accept
                    }
                };
                testClient.setLayersFiltersParams([adm0nameFilter]);
                testClient.getWidget(0, 'adm0name', { own_filter: 1 }, function (err, aggregation) {
                    assert.ok(!err, err);
                    assert.ok(aggregation);
                    assert.equal(aggregation.type, 'aggregation');

                    assert.equal(aggregation.categories.length, scenario.accept.length);

                    var categoriesByCategory = aggregation.categories.reduce(function(byCategory, row) {
                        byCategory[row.category] = row;
                        return byCategory;
                    }, {});

                    var scenarioByCategory = scenario.accept.reduce(function(byCategory, category, index) {
                        byCategory[category] = { category: category, value: scenario.values[index], agg: false };
                        return byCategory;
                    }, {});

                    Object.keys(categoriesByCategory).forEach(function(category) {
                        assert.deepEqual(categoriesByCategory[category], scenarioByCategory[category]);
                    });

                    done();
                });
            });
        });

        var numericAggregationMapConfig = {
            version: '1.5.0',
            layers: [
                {
                    type: 'mapnik',
                    options: {
                        sql: 'select * from populated_places_simple_reduced',
                        cartocss: '#layer0 { marker-fill: red; marker-width: 10; }',
                        cartocss_version: '2.3.0',
                        widgets: {
                            scalerank: {
                                type: 'aggregation',
                                options: {
                                    column: 'scalerank',
                                    aggregation: 'count'
                                }
                            }
                        }
                    }
                }
            ]
        };

        ['1', 1].forEach(function(filterValue) {
            it('can filter numeric categories: ' + (typeof filterValue), function(done) {
                var testClient = new TestClient(numericAggregationMapConfig);
                var scalerankFilter = {
                    scalerank: {
                        accept: [filterValue]
                    }
                };
                testClient.setLayersFiltersParams([scalerankFilter]);
                testClient.getWidget(0, 'scalerank', { own_filter: 1 }, function (err, aggregation) {
                    assert.ok(!err, err);
                    assert.ok(aggregation);
                    assert.equal(aggregation.type, 'aggregation');

                    assert.equal(aggregation.categories.length, 1);
                    assert.deepEqual(aggregation.categories[0], { category: '1', value: 179, agg: false });

                    done();
                });
            });
        });

    });

    describe('formula', function() {
        function formulaMapConfig(operation) {
            return {
                version: '1.5.0',
                layers: [
                    {
                        type: 'mapnik',
                        options: {
                            sql: 'select * from populated_places_simple_reduced where pop_max > 0 and pop_max < 600000',
                            cartocss: '#layer0 { marker-fill: red; marker-width: 10; }',
                            cartocss_version: '2.0.1',
                            widgets: {
                                pop_max_f: {
                                    type: 'formula',
                                    options: {
                                        column: 'pop_max',
                                        operation: operation
                                    }
                                }
                            }
                        }
                    }
                ]
            };
        }

        var operations = {
            min: [10, 0],
            max: [599579, 0],
            count: [5822, 0],
            avg: [112246.00893163861, 0],
            sum: [653496264, 0]
        };

        Object.keys(operations).forEach(function(operation) {
            it('should do ' + operation + ' over column', function(done) {
                var testClient = new TestClient(formulaMapConfig(operation));
                testClient.getWidget(0, 'pop_max_f', function (err, result) {
                    assert.ok(!err, err);
                    assert.equal(result.operation, operation);
                    assert.equal(result.result, operations[operation][0]);
                    assert.equal(result.nulls, operations[operation][1]);

                    done();
                });
            });
        });

    });
});
