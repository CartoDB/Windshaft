require('../support/test_helper.js');

var assert = require('assert');
var MapConfig = require('../../lib/windshaft/models/mapconfig');

describe('mapconfig filters', function() {

    describe('should return an object with filtered aggregations', function() {
        var listsMapConfig = {
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
                                    aggregation: 'count',
                                    column: 'adm0name'
                                }
                            }
                        }
                    }
                }
            ]
        };

        it('uses accept filter param', function() {
            var mapConfig = MapConfig.create(listsMapConfig);
            var acceptFilterMapConfig = mapConfig.applyFilters({layers: [{
                adm0name: { // this is category filter associated to the aggregation widget
                    accept: ['Spain']
                }
            }]});

            var filteredList = acceptFilterMapConfig.getWidget(0, 'adm0name');
            assert.equal(filteredList.sql(),
                    "SELECT count(*) AS count, adm0name FROM" +
                    " (SELECT * FROM" +
                    " (select * from populated_places_simple_reduced) " +
                    "_cdb_category_filter WHERE adm0name IN ('Spain')) " +
                    "_cdb_aggregation GROUP BY adm0name ORDER BY count DESC"
            );

            // check original mapconfig keeps it right
            var list = mapConfig.getWidget(0, 'adm0name');
            assert.equal(list.sql(),
                    "SELECT count(*) AS count, adm0name FROM" +
                    " (select * from populated_places_simple_reduced) " +
                    "_cdb_aggregation GROUP BY adm0name ORDER BY count DESC"
            );
        });

        it('uses reject filter param', function() {
            var mapConfig = MapConfig.create(listsMapConfig);

            var rejectFilterMapConfig = mapConfig.applyFilters({layers: [{
                adm0name: { // this is category filter associated to the aggregation widget
                    reject: ['Spain']
                }
            }]});
            var rejectFilterList = rejectFilterMapConfig.getWidget(0, 'adm0name');
            assert.equal(rejectFilterList.sql(),
                    "SELECT count(*) AS count, adm0name FROM" +
                    " (SELECT * FROM" +
                    " (select * from populated_places_simple_reduced) " +
                    "_cdb_category_filter WHERE adm0name NOT IN ('Spain')) " +
                    "_cdb_aggregation GROUP BY adm0name ORDER BY count DESC"
            );

            // check original mapconfig keeps it right
            var list = mapConfig.getWidget(0, 'adm0name');
            assert.equal(list.sql(),
                    "SELECT count(*) AS count, adm0name FROM" +
                    " (select * from populated_places_simple_reduced) " +
                    "_cdb_aggregation GROUP BY adm0name ORDER BY count DESC"
            );
        });

        it('uses accept and reject filter param', function() {
            var mapConfig = MapConfig.create(listsMapConfig);

            var acceptAndRejectFilterMapConfig = mapConfig.applyFilters({layers: [{
                adm0name: { // this is category filter associated to the aggregation widget
                    reject: ['Spain'],
                    accept: ['USA']
                }
            }]});
            var acceptAndRejectFilterList = acceptAndRejectFilterMapConfig.getWidget(0, 'adm0name');

            assert.equal(acceptAndRejectFilterList.sql(),
                    "SELECT count(*) AS count, adm0name FROM" +
                    " (SELECT * FROM" +
                    " (select * from populated_places_simple_reduced) " +
                    "_cdb_category_filter WHERE adm0name IN ('USA') AND adm0name NOT IN ('Spain')) " +
                    "_cdb_aggregation GROUP BY adm0name ORDER BY count DESC"
            );

            // check original mapconfig keeps it right
            var list = mapConfig.getWidget(0, 'adm0name');
            assert.equal(list.sql(),
                    "SELECT count(*) AS count, adm0name FROM" +
                    " (select * from populated_places_simple_reduced) " +
                    "_cdb_aggregation GROUP BY adm0name ORDER BY count DESC"
            );
        });
    });

});

