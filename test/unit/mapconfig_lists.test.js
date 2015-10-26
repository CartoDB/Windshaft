require('../support/test_helper.js');

var assert = require('assert');
var MapConfig = require('../../lib/windshaft/models/mapconfig');

describe('mapconfig lists', function() {

    var noListsMapConfig = {
        version: '1.5.0',
        layers: [
            {
                type: 'mapnik',
                options: {
                    sql: 'select * from test_table',
                    cartocss: '#layer0 { marker-fill: red; marker-width: 10; }',
                    cartocss_version: '2.0.1'
                }
            }
        ]
    };

    it('should fail to retrieve a list from nonexistent layer', function() {
        var mapConfig = MapConfig.create(noListsMapConfig);

        assert.throws(
            function() {
                mapConfig.getWidget(1, 'wadus');
            },
            function(err) {
                assert.equal(err.message, 'Layer 1 not found');
                return true;
            }
        );
    });

    it('should return empty object when config has no lists', function() {
        var mapConfig = MapConfig.create(noListsMapConfig);

        assert.throws(
            function() {
                mapConfig.getWidget(0, 'nonexistent');
            },
            function(err) {
                assert.equal(err.message, "Widget 'nonexistent' not found at layer 0");
                return true;
            }
        );
    });

    it('should return an object with lists from config', function() {
        var layerSql = 'select * from test_table';
        var listsMapConfig = {
            version: '1.5.0',
            layers: [
                {
                    type: 'mapnik',
                    options: {
                        sql: layerSql,
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
        var mapConfig = MapConfig.create(listsMapConfig);

        var list = mapConfig.getWidget(0, 'places');
        assert.equal(list.sql(), "select name, address from ( select * from test_table ) as _windshaft_subquery");
    });

    it('should return an object with lists from layers', function() {
        var listsMapConfig = {
            version: '1.5.0',
            layers: [
                {
                    type: 'mapnik',
                    options: {
                        sql: 'select * from test_table',
                        cartocss: '#layer0 { marker-fill: red; marker-width: 10; }',
                        cartocss_version: '2.3.0',
                        widgets: {
                            places: {
                                type: 'list',
                                options: {
                                    columns: ['address']
                                }
                            }
                        }
                    }
                },
                {
                    type: 'mapnik',
                    options: {
                        sql: 'select * from test_table',
                        cartocss: '#layer1 { marker-fill: red; marker-width: 10; }',
                        cartocss_version: '2.3.0',
                        widgets: {
                            places_2: {
                                type: 'list',
                                options: {
                                    columns: ['name']
                                }
                            }
                        }
                    }
                }
            ]
        };
        var mapConfig = MapConfig.create(listsMapConfig);

        var placesList = mapConfig.getWidget(0, 'places');
        assert.equal(placesList.sql(), "select address from ( select * from test_table ) as _windshaft_subquery");
        assert.deepEqual(placesList.columns, ['address']);

        var places2List = mapConfig.getWidget(1, 'places_2');
        assert.equal(places2List.sql(), "select name from ( select * from test_table ) as _windshaft_subquery");
        assert.deepEqual(places2List.columns, ['name']);
    });

});

