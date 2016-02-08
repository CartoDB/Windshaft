require('../../support/test_helper');

var assert        = require('../../support/assert');
var TestClient = require('../../support/test_client');
var _ = require('underscore');

describe('widgets', function() {

    describe('lists', function() {

        function listsMapConfig(columns) {
            return {
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
                                        columns: columns || ['name', 'address']
                                    }
                                }
                            }
                        }
                    }
                ]
            };
        }

        it('cannot be fetched from nonexistent list name', function(done) {
            var testClient = new TestClient(listsMapConfig());
            testClient.getWidget(0, 'nonexistent', function (err) {
                assert.ok(err);
                assert.equal(err.message, "Widget 'nonexistent' not found at layer 0");
                done();
            });
        });

        var EXPECTED_NAMES = ['Hawai', 'El Estocolmo', 'El Rey del Tallarín', 'El Lacón', 'El Pico'];

        it('can be fetched from a valid list', function(done) {
            var columns = ['name', 'address'];
            var testClient = new TestClient(listsMapConfig(columns));
            testClient.getWidget(0, 'places', function (err, list) {
                assert.ok(!err, err);
                assert.ok(list);
                assert.equal(list.type, 'list');
                assert.equal(list.rows.length, 5);

                assert.ok(onlyHasFields(list, columns));

                var names = list.rows.map(function (item) {
                    return item.name;
                });
                assert.deepEqual(names, EXPECTED_NAMES);

                var expectedAddresses = [
                    'Calle de Pérez Galdós 9, Madrid, Spain',
                    'Calle de la Palma 72, Madrid, Spain',
                    'Plaza Conde de Toreno 2, Madrid, Spain',
                    'Manuel Fernández y González 8, Madrid, Spain',
                    'Calle Divino Pastor 12, Madrid, Spain'
                ];
                var addresses = list.rows.map(function (item) {
                    return item.address;
                });
                assert.deepEqual(addresses, expectedAddresses);

                done();
            });
        });

        it('should fetch just one column', function(done) {
            var columns = ['name'];
            var testClient = new TestClient(listsMapConfig(columns));
            testClient.getWidget(0, 'places', function (err, list) {
                assert.ok(!err, err);
                assert.ok(list);
                assert.equal(list.type, 'list');
                assert.equal(list.rows.length, 5);

                assert.ok(onlyHasFields(list, columns));

                var names = list.rows.map(function (item) {
                    return item.name;
                });
                assert.deepEqual(names, EXPECTED_NAMES);

                done();
            });
        });

        function onlyHasFields(list, expectedFields) {
            var fields = (!!list.rows[0]) ? Object.keys(list.rows[0]) : [];

            return _.difference(fields, expectedFields).length === 0 &&
                _.difference(expectedFields, fields).length === 0;
        }

    });

});
