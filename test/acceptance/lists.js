require('../support/test_helper');

var assert        = require('../support/assert');
var TestClient = require('../support/test_client');

describe('list', function() {

    var mapConfig = {
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

    var listsMapConfig = {
        version: '1.5.0',
        layers: [
            {
                type: 'mapnik',
                options: {
                    sql: 'select * from test_table',
                    cartocss: '#layer0 { marker-fill: red; marker-width: 10; }',
                    cartocss_version: '2.0.1'
                },
                lists: {
                    places: {
                        sql: 'select * from test_table',
                        columns: ['name', 'address']
                    }
                }
            }
        ]
    };

    it('cannot be fetched from MapConfig with no lists', function(done) {
        var testClient = new TestClient(mapConfig);
        testClient.getList('any', function (err) {
            assert.ok(err);
            assert.equal(err.message, 'MapConfig has no exposed lists');
            done();
        });
    });

    it('cannot be fetched from nonexistent list name', function(done) {
        var testClient = new TestClient(listsMapConfig);
        testClient.getList('nonexistent', function (err) {
            assert.ok(err);
            assert.equal(err.message, "List 'nonexistent' does not exists");
            done();
        });
    });

    it('can be fetched from a valid list', function(done) {
        var testClient = new TestClient(listsMapConfig);
        testClient.getList('places', function (err, list) {
            assert.ok(!err);
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

    it('should fetch all columns when no columns are specified', function(done) {
        var testClient = new TestClient({
            version: '1.5.0',
            layers: [
                {
                    type: 'mapnik',
                    options: {
                        sql: 'select * from test_table',
                        cartocss: '#layer0 { marker-fill: red; marker-width: 10; }',
                        cartocss_version: '2.0.1'
                    },
                    lists: {
                        places: {
                            sql: 'select * from test_table'
                        }
                    }
                }
            ]
        });
        testClient.getList('places', function (err, list) {
            assert.ok(!err);
            assert.ok(list);
            assert.equal(list.length, 5);

            assert.deepEqual(Object.keys(list[0]), [
                'updated_at',
                'created_at',
                'cartodb_id',
                'name',
                'address',
                'the_geom',
                'the_geom_webmercator'
            ]);

            done();
        });
    });

});
