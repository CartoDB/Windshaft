require('../support/test_helper.js');

var assert = require('assert');
var MapConfig = require('../../lib/windshaft/models/mapconfig');

describe('mapconfig filters', function() {

    describe('aggregations', function() {

        var layerSql = 'select * from populated_places_simple_reduced';

        var categoryWidgetMapConfig = {
            version: '1.5.0',
            layers: [
                {
                    type: 'mapnik',
                    options: {
                        sql: layerSql,
                        cartocss: '#layer0 { marker-fill: red; marker-width: 10; }',
                        cartocss_version: '2.0.1',
                        widgets: {
                            adm0name: {
                                type: 'aggregation',
                                options: {
                                    aggregation: 'count',
                                    column: 'adm0name'
                                }
                            }
                        }
                    }
                }
            ]
        };

        describe('errors', function() {
            var mapConfig = MapConfig.create(categoryWidgetMapConfig);

            it('fails to apply category filter if no params are used', function() {
                assert.throws(
                    function() {
                        mapConfig.setFiltersParams({layers: [{
                            adm0name: {}
                        }]});
                    },
                    function(err) {
                        assert.equal(
                            err.message,
                            'Category filter expects at least one array in accept or reject params'
                        );
                        return true;
                    }
                );
            });

            it('fails to apply category filter if accept is empty', function() {
                assert.throws(
                    function() {
                        mapConfig.setFiltersParams({layers: [{
                            adm0name: {
                                accept: []
                            }
                        }]});
                    },
                    function(err) {
                        assert.equal(
                            err.message,
                            'Category filter expects to have at least one value in accept or reject arrays'
                        );
                        return true;
                    }
                );
            });

            it('fails to apply category filter if reject is empty', function() {
                assert.throws(
                    function() {
                        mapConfig.setFiltersParams({layers: [{
                            adm0name: {
                                reject: []
                            }
                        }]});
                    },
                    function(err) {
                        assert.equal(
                            err.message,
                            'Category filter expects to have at least one value in accept or reject arrays'
                        );
                        return true;
                    }
                );
            });
        });

        describe('queries with filters', function() {

            it('uses accept filter param', function() {
                var mapConfig = MapConfig.create(categoryWidgetMapConfig);
                var mapConfigId = mapConfig.id();

                assert.equal(mapConfig.getLayer(0).options.sql, layerSql);

                mapConfig.setFiltersParams({layers: [{
                    adm0name: { // this is a category filter associated to the aggregation widget
                        accept: ['Spain']
                    }
                }]});

                assert.equal(mapConfig.getLayer(0).options.sql,
                    [
                        'SELECT *',
                        'FROM (select * from populated_places_simple_reduced) _cdb_category_filter',
                        'WHERE adm0name IN ($string_0$Spain$string_0$)'
                    ].join('\n')
                );

                assert.notEqual(mapConfig.id(), mapConfigId);

                var acceptFilterAggregation = mapConfig.getWidget(0, 'adm0name');
                assert.equal(acceptFilterAggregation.sql(mapConfig.getLayerFilters(0)),
                    [
                        'WITH',
                        'summary AS (',
                        '  SELECT',
                        '  count(1) AS count,',
                        '  sum(CASE WHEN adm0name IS NULL THEN 1 ELSE 0 END) AS nulls_count',
                        '  FROM (SELECT *',
                        'FROM (select * from populated_places_simple_reduced) _cdb_category_filter',
                        'WHERE adm0name IN ($string_0$Spain$string_0$)) _cdb_aggregation_nulls',
                        '),',
                        'categories AS(',
                        '  SELECT adm0name AS category, count(1) AS value,',
                        '    row_number() OVER (ORDER BY count(1) desc) as rank',
                        '  FROM (SELECT *',
                        'FROM (select * from populated_places_simple_reduced) _cdb_category_filter',
                        'WHERE adm0name IN ($string_0$Spain$string_0$)) _cdb_aggregation_all',
                        '  GROUP BY adm0name',
                        '  ORDER BY 2 DESC',
                        '),',
                        'categories_summary AS(',
                        '  SELECT count(1) categories_count, max(value) max_val, min(value) min_val',
                        '  FROM categories',
                        ')',
                        'SELECT CAST(category AS text), value, false as agg, nulls_count, min_val, max_val, count, categories_count',
                        '  FROM categories, summary, categories_summary',
                        '  WHERE rank < 6',
                        'UNION ALL',
                        'SELECT \'Other\' category, sum(value), true as agg, nulls_count, min_val, max_val, count, categories_count',
                        '  FROM categories, summary, categories_summary',
                        '  WHERE rank >= 6',
                        'GROUP BY nulls_count, min_val, max_val, count, categories_count'
                    ].join('\n')
                );

                mapConfig.clearFilters();
                assert.equal(mapConfig.id(), mapConfigId);

                // check original mapconfig keeps it right
                var aggregation = mapConfig.getWidget(0, 'adm0name');
                assert.equal(aggregation.sql(),
                    [
                        'WITH',
                        'summary AS (',
                        '  SELECT',
                        '  count(1) AS count,',
                        '  sum(CASE WHEN adm0name IS NULL THEN 1 ELSE 0 END) AS nulls_count',
                        '  FROM (select * from populated_places_simple_reduced) _cdb_aggregation_nulls',
                        '),',
                        'categories AS(',
                        '  SELECT adm0name AS category, count(1) AS value,',
                        '    row_number() OVER (ORDER BY count(1) desc) as rank',
                        '  FROM (select * from populated_places_simple_reduced) _cdb_aggregation_all',
                        '  GROUP BY adm0name',
                        '  ORDER BY 2 DESC',
                        '),',
                        'categories_summary AS(',
                        '  SELECT count(1) categories_count, max(value) max_val, min(value) min_val',
                        '  FROM categories',
                        ')',
                        'SELECT CAST(category AS text), value, false as agg, nulls_count, min_val, max_val, count, categories_count',
                        '  FROM categories, summary, categories_summary',
                        '  WHERE rank < 6',
                        'UNION ALL',
                        'SELECT \'Other\' category, sum(value), true as agg, nulls_count, min_val, max_val, count, categories_count',
                        '  FROM categories, summary, categories_summary',
                        '  WHERE rank >= 6',
                        'GROUP BY nulls_count, min_val, max_val, count, categories_count'
                    ].join('\n')

                );
            });

            it('uses reject filter param', function() {
                var mapConfig = MapConfig.create(categoryWidgetMapConfig);

                mapConfig.setFiltersParams({layers: [{
                    adm0name: { // this is a category filter associated to the aggregation widget
                        reject: ['Spain']
                    }
                }]});
                var rejectFilterAggregation = mapConfig.getWidget(0, 'adm0name');
                assert.equal(rejectFilterAggregation.sql(mapConfig.getLayerFilters(0)),
                    [
                        'WITH',
                        'summary AS (',
                        '  SELECT',
                        '  count(1) AS count,',
                        '  sum(CASE WHEN adm0name IS NULL THEN 1 ELSE 0 END) AS nulls_count',
                        '  FROM (SELECT *',
                        'FROM (select * from populated_places_simple_reduced) _cdb_category_filter',
                        'WHERE adm0name NOT IN ($string_0$Spain$string_0$)) _cdb_aggregation_nulls',
                        '),',
                        'categories AS(',
                        '  SELECT adm0name AS category, count(1) AS value,',
                        '    row_number() OVER (ORDER BY count(1) desc) as rank',
                        '  FROM (SELECT *',
                        'FROM (select * from populated_places_simple_reduced) _cdb_category_filter',
                        'WHERE adm0name NOT IN ($string_0$Spain$string_0$)) _cdb_aggregation_all',
                        '  GROUP BY adm0name',
                        '  ORDER BY 2 DESC',
                        '),',
                        'categories_summary AS(',
                        '  SELECT count(1) categories_count, max(value) max_val, min(value) min_val',
                        '  FROM categories',
                        ')',
                        'SELECT CAST(category AS text), value, false as agg, nulls_count, min_val, max_val, count, categories_count',
                        '  FROM categories, summary, categories_summary',
                        '  WHERE rank < 6',
                        'UNION ALL',
                        'SELECT \'Other\' category, sum(value), true as agg, nulls_count, min_val, max_val, count, categories_count',
                        '  FROM categories, summary, categories_summary',
                        '  WHERE rank >= 6',
                        'GROUP BY nulls_count, min_val, max_val, count, categories_count'
                    ].join('\n')

                );

                // check original mapconfig keeps it right
                mapConfig.clearFilters();
                var aggregation = mapConfig.getWidget(0, 'adm0name');
                assert.equal(aggregation.sql(),
                    [
                        'WITH',
                        'summary AS (',
                        '  SELECT',
                        '  count(1) AS count,',
                        '  sum(CASE WHEN adm0name IS NULL THEN 1 ELSE 0 END) AS nulls_count',
                        '  FROM (select * from populated_places_simple_reduced) _cdb_aggregation_nulls',
                        '),',
                        'categories AS(',
                        '  SELECT adm0name AS category, count(1) AS value,',
                        '    row_number() OVER (ORDER BY count(1) desc) as rank',
                        '  FROM (select * from populated_places_simple_reduced) _cdb_aggregation_all',
                        '  GROUP BY adm0name',
                        '  ORDER BY 2 DESC',
                        '),',
                        'categories_summary AS(',
                        '  SELECT count(1) categories_count, max(value) max_val, min(value) min_val',
                        '  FROM categories',
                        ')',
                        'SELECT CAST(category AS text), value, false as agg, nulls_count, min_val, max_val, count, categories_count',
                        '  FROM categories, summary, categories_summary',
                        '  WHERE rank < 6',
                        'UNION ALL',
                        'SELECT \'Other\' category, sum(value), true as agg, nulls_count, min_val, max_val, count, categories_count',
                        '  FROM categories, summary, categories_summary',
                        '  WHERE rank >= 6',
                        'GROUP BY nulls_count, min_val, max_val, count, categories_count'
                    ].join('\n')

                );
            });

            it('uses accept and reject filter param', function() {
                var mapConfig = MapConfig.create(categoryWidgetMapConfig);

                mapConfig.setFiltersParams({layers: [{
                    adm0name: { // this is a category filter associated to the aggregation widget
                        reject: ['Spain'],
                        accept: ['USA']
                    }
                }]});
                var acceptAndRejectFilterAggregation = mapConfig.getWidget(0, 'adm0name');

                assert.equal(acceptAndRejectFilterAggregation.sql(mapConfig.getLayerFilters(0)),
                    [
                        'WITH',
                        'summary AS (',
                        '  SELECT',
                        '  count(1) AS count,',
                        '  sum(CASE WHEN adm0name IS NULL THEN 1 ELSE 0 END) AS nulls_count',
                        '  FROM (SELECT *',
                        'FROM (select * from populated_places_simple_reduced) _cdb_category_filter',
                        'WHERE adm0name IN ($string_0$USA$string_0$) AND adm0name NOT IN ($string_0$Spain$string_0$)) _cdb_aggregation_nulls',
                        '),',
                        'categories AS(',
                        '  SELECT adm0name AS category, count(1) AS value,',
                        '    row_number() OVER (ORDER BY count(1) desc) as rank',
                        '  FROM (SELECT *',
                        'FROM (select * from populated_places_simple_reduced) _cdb_category_filter',
                        'WHERE adm0name IN ($string_0$USA$string_0$) AND adm0name NOT IN ($string_0$Spain$string_0$)) _cdb_aggregation_all',
                        '  GROUP BY adm0name',
                        '  ORDER BY 2 DESC',
                        '),',
                        'categories_summary AS(',
                        '  SELECT count(1) categories_count, max(value) max_val, min(value) min_val',
                        '  FROM categories',
                        ')',
                        'SELECT CAST(category AS text), value, false as agg, nulls_count, min_val, max_val, count, categories_count',
                        '  FROM categories, summary, categories_summary',
                        '  WHERE rank < 6',
                        'UNION ALL',
                        'SELECT \'Other\' category, sum(value), true as agg, nulls_count, min_val, max_val, count, categories_count',
                        '  FROM categories, summary, categories_summary',
                        '  WHERE rank >= 6',
                        'GROUP BY nulls_count, min_val, max_val, count, categories_count'
                    ].join('\n')

                );

                // check original mapconfig keeps it right
                mapConfig.clearFilters();
                var aggregation = mapConfig.getWidget(0, 'adm0name');
                assert.equal(aggregation.sql(),
                    [
                        'WITH',
                        'summary AS (',
                        '  SELECT',
                        '  count(1) AS count,',
                        '  sum(CASE WHEN adm0name IS NULL THEN 1 ELSE 0 END) AS nulls_count',
                        '  FROM (select * from populated_places_simple_reduced) _cdb_aggregation_nulls',
                        '),',
                        'categories AS(',
                        '  SELECT adm0name AS category, count(1) AS value,',
                        '    row_number() OVER (ORDER BY count(1) desc) as rank',
                        '  FROM (select * from populated_places_simple_reduced) _cdb_aggregation_all',
                        '  GROUP BY adm0name',
                        '  ORDER BY 2 DESC',
                        '),',
                        'categories_summary AS(',
                        '  SELECT count(1) categories_count, max(value) max_val, min(value) min_val',
                        '  FROM categories',
                        ')',
                        'SELECT CAST(category AS text), value, false as agg, nulls_count, min_val, max_val, count, categories_count',
                        '  FROM categories, summary, categories_summary',
                        '  WHERE rank < 6',
                        'UNION ALL',
                        'SELECT \'Other\' category, sum(value), true as agg, nulls_count, min_val, max_val, count, categories_count',
                        '  FROM categories, summary, categories_summary',
                        '  WHERE rank >= 6',
                        'GROUP BY nulls_count, min_val, max_val, count, categories_count'
                    ].join('\n')

                );
            });
        });

    });

    describe('range', function() {
        var histogramWidgetMapConfig = {
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
                                type: 'histogram',
                                options: {
                                    column: 'adm0name'
                                }
                            }
                        }
                    }
                }
            ]
        };

        describe('errors', function() {
            var mapConfig = MapConfig.create(histogramWidgetMapConfig);

            it('fails to apply range filter if no params are used', function() {
                assert.throws(
                    function() {
                        mapConfig.setFiltersParams({layers: [{
                            adm0name: {}
                        }]});
                    },
                    function(err) {
                        assert.equal(
                            err.message,
                            'Range filter expect to have at least one value in min or max numeric params'
                        );
                        return true;
                    }
                );
            });

            it('fails to apply range filter if min is not a number', function() {
                assert.throws(
                    function() {
                        mapConfig.setFiltersParams({layers: [{
                            adm0name: {
                                min: 'wadus'
                            }
                        }]});
                    },
                    function(err) {
                        assert.equal(
                            err.message,
                            'Range filter expect to have at least one value in min or max numeric params'
                        );
                        return true;
                    }
                );
            });

            it('fails to apply range filter if max is not a number', function() {
                assert.throws(
                    function() {
                        mapConfig.setFiltersParams({layers: [{
                            adm0name: {
                                max: 'wadus'
                            }
                        }]});
                    },
                    function(err) {
                        assert.equal(
                            err.message,
                            'Range filter expect to have at least one value in min or max numeric params'
                        );
                        return true;
                    }
                );
            });
        });

        describe('queries with filters', function() {
            it('uses min filter param', function() {
                var mapConfig = MapConfig.create(histogramWidgetMapConfig);
                mapConfig.setFiltersParams({layers: [{
                    adm0name: { // this is a range filter associated to the histogram widget
                        min: 0
                    }
                }]});

                var filteredHistogram = mapConfig.getWidget(0, 'adm0name');
                assert.ok(
                    filteredHistogram.sql(mapConfig.getLayerFilters(0)).match(/_cdb_range_filter WHERE adm0name > 0/)
                );

                // check original mapconfig keeps it right
                mapConfig.clearFilters();
                var histogram = mapConfig.getWidget(0, 'adm0name');
                assert.ok(!histogram.sql().match(/_cdb_range_filter/));
            });

            it('uses max filter param', function() {
                var mapConfig = MapConfig.create(histogramWidgetMapConfig);
                mapConfig.setFiltersParams({layers: [{
                    adm0name: { // this is a range filter associated to the histogram widget
                        max: 100
                    }
                }]});

                var filteredHistogram = mapConfig.getWidget(0, 'adm0name');
                assert.ok(
                    filteredHistogram.sql(mapConfig.getLayerFilters(0)).match(/_cdb_range_filter WHERE adm0name < 100/)
                );

                // check original mapconfig keeps it right
                mapConfig.clearFilters();
                var histogram = mapConfig.getWidget(0, 'adm0name');
                assert.ok(!histogram.sql().match(/_cdb_range_filter/));
            });

            it('uses min and max filter params', function() {
                var mapConfig = MapConfig.create(histogramWidgetMapConfig);
                mapConfig.setFiltersParams({layers: [{
                    adm0name: { // this is a range filter associated to the histogram widget
                        min: 0,
                        max: 100
                    }
                }]});

                var filteredHistogram = mapConfig.getWidget(0, 'adm0name');
                assert.ok(
                    filteredHistogram.sql(mapConfig.getLayerFilters(0))
                        .match(/_cdb_range_filter WHERE adm0name BETWEEN 0 AND 100/)
                );

                // check original mapconfig keeps it right
                mapConfig.clearFilters();
                var histogram = mapConfig.getWidget(0, 'adm0name');
                assert.ok(!histogram.sql().match(/_cdb_range_filter/));
            });
        });

    });

});

