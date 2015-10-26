require('../support/test_helper');

var assert        = require('../support/assert');
var TestClient = require('../support/test_client');

describe('list', function() {

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
                widgets: {
                    places: {
                        type: 'list',
                        options: {
                            columns: ['name', 'address']
                        }
                    }
                }
            }
        ]
    };

    it('cannot be fetched from nonexistent list name', function(done) {
        var testClient = new TestClient(listsMapConfig);
        testClient.getList(0, 'nonexistent', function (err) {
            assert.ok(err);
            assert.equal(err.message, "Widget 'nonexistent' not found at layer 0");
            done();
        });
    });

    it('can be fetched from a valid list', function(done) {
        var testClient = new TestClient(listsMapConfig);
        testClient.getList(0, 'places', function (err, list) {
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
