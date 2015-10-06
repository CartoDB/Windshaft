require('../support/test_helper.js');

var assert = require('assert');
var MapConfig = require('../../lib/windshaft/models/mapconfig');

describe('mapconfig lists', function() {

    it('should return empty object when config has no lists', function() {
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

        var mapConfig = MapConfig.create(noListsMapConfig);

        assert.deepEqual(mapConfig.getLists(), {});
    });

    it('should return an object with lists from config', function() {
        var listsMapConfig = {
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
            ],
            lists: {
                places: {
                    sql: 'select * from test_table',
                    columns: ['name', 'address']
                }
            }
        };
        var mapConfig = MapConfig.create(listsMapConfig);

        assert.deepEqual(Object.keys(mapConfig.getLists()), ['places']);
        assert.deepEqual(mapConfig.getLists().places.getConfig(), {
            sql: 'select * from test_table',
            columns: ['name', 'address']
        });
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
                        cartocss_version: '2.3.0'
                    },
                    lists: {
                        places: {
                            sql: 'select * from test_table',
                            columns: ['address']
                        }
                    }
                },
                {
                    type: 'mapnik',
                    options: {
                        sql: 'select * from test_table',
                        cartocss: '#layer1 { marker-fill: red; marker-width: 10; }',
                        cartocss_version: '2.3.0'
                    },
                    lists: {
                        places_2: {
                            sql: 'select * from test_table',
                            columns: ['name']
                        }
                    }
                }
            ]
        };
        var mapConfig = MapConfig.create(listsMapConfig);

        assert.deepEqual(Object.keys(mapConfig.getLists()), ['places', 'places_2']);
        assert.deepEqual(mapConfig.getLists().places.getConfig(), {
            sql: 'select * from test_table',
            columns: ['address']
        });
        assert.deepEqual(mapConfig.getLists().places_2.getConfig(), {
            sql: 'select * from test_table',
            columns: ['name']
        });
    });

    it('should return an object with lists from layers and sql from layers if not present in list def', function() {
        var listsMapConfig = {
            version: '1.5.0',
            layers: [
                {
                    type: 'mapnik',
                    options: {
                        sql: 'select * from test_table limit 4',
                        cartocss: '#layer0 { marker-fill: red; marker-width: 10; }',
                        cartocss_version: '2.3.0'
                    },
                    lists: {
                        places: {
                            columns: ['address']
                        }
                    }
                },
                {
                    type: 'mapnik',
                    options: {
                        sql: 'select * from test_table limit 2',
                        cartocss: '#layer1 { marker-fill: red; marker-width: 10; }',
                        cartocss_version: '2.3.0'
                    },
                    lists: {
                        places_2: {
                            sql: 'select * from test_table',
                            columns: ['name']
                        }
                    }
                }
            ]
        };
        var mapConfig = MapConfig.create(listsMapConfig);

        assert.deepEqual(Object.keys(mapConfig.getLists()), ['places', 'places_2']);
        assert.deepEqual(mapConfig.getLists().places.getConfig(), {
            sql: 'select * from test_table limit 4',
            columns: ['address']
        });
        assert.deepEqual(mapConfig.getLists().places_2.getConfig(), {
            sql: 'select * from test_table',
            columns: ['name']
        });
    });

    it('should default to all columns when no columns are specified', function() {
        var listsMapConfig = {
            version: '1.5.0',
            layers: [
                {
                    type: 'mapnik',
                    options: {
                        sql: 'select * from test_table limit 4',
                        cartocss: '#layer0 { marker-fill: red; marker-width: 10; }',
                        cartocss_version: '2.3.0'
                    },
                    lists: {
                        places: {}
                    }
                },
                {
                    type: 'mapnik',
                    options: {
                        sql: 'select * from test_table limit 2',
                        cartocss: '#layer1 { marker-fill: red; marker-width: 10; }',
                        cartocss_version: '2.3.0'
                    },
                    lists: {
                        places_2: {
                            sql: 'select * from test_table'
                        }
                    }
                }
            ]
        };
        var mapConfig = MapConfig.create(listsMapConfig);

        assert.deepEqual(Object.keys(mapConfig.getLists()), ['places', 'places_2']);
        assert.deepEqual(mapConfig.getLists().places.getConfig(), {
            sql: 'select * from test_table limit 4',
            columns: ['*']
        });
        assert.deepEqual(mapConfig.getLists().places_2.getConfig(), {
            sql: 'select * from test_table',
            columns: ['*']
        });
    });

});

