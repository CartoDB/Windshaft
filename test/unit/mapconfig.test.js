require('../support/test_helper.js');

var assert = require('assert');
var MapConfig = require('../../lib/windshaft/models/mapconfig');

describe('mapconfig', function() {

    it('can not create mapconfig with invalid version', function(done) {
        var version = '0.1.0';
        assert.throws(
            function() {
                MapConfig.create({
                    version: version
                });
            },
            function(err) {
                assert.equal(err.message, 'Unsupported layergroup configuration version ' + version);
                done();
                return true;
            }
        );
    });

    it('can not create mapconfig with no options in layer', function(done) {
        assert.throws(
            function() {
                MapConfig.create({
                    version: '1.3.0',
                    layers: [
                        {
                            type: 'mapnik'
                        }
                    ]
                });
            },
            function(err) {
                assert.equal(err.message, 'Missing options from layer 0 of layergroup config');
                done();
                return true;
            }
        );
    });

    it('interactivity array gets converted into comma joined string', function(done) {
        var mapConfig = MapConfig.create({
            version: '1.3.0',
            layers: [
                {
                    type: 'mapnik',
                    options: {
                        sql: 'select 1 a, 2 b, null::geometry the_geom',
                        cartocss: '#layer{}',
                        cartocss_version: '2.3.0',
                        interactivity: ['a', 'b']
                    }
                }
            ]
        });

        var layer = mapConfig.getLayer(0);
        assert.equal(layer.options.interactivity, 'a,b');
        done();
    });

    // See https://github.com/CartoDB/Windshaft/issues/154
    it('should fail when trying to use attribute service with mapnik tokens', function(done) {
        var mapConfig =  {
            version: '1.1.0',
            layers: [
                {
                    options: {
                        sql: 'select cartodb_id, 1 as n, the_geom, !bbox! as b from test_table limit 1',
                        cartocss: '#layer { marker-fill:red }',
                        cartocss_version: '2.0.1',
                        attributes: {
                            id:'cartodb_id',
                            columns:['n']
                        }
                    }
                }
            ]
        };
        assert.throws(
            function() {
                MapConfig.create(mapConfig);
            },
            function(err) {
                assert.equal(
                    err.message,
                    'Attribute service cannot be activated on layer 0: using dynamic sql (mapnik tokens)'
                );
                done();
                return true;
            }
        );
    });

});

