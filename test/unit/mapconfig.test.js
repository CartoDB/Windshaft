require('../support/test_helper.js');

var assert        = require('assert');
var MapConfig     = require('../../lib/windshaft/models/mapconfig');

suite('mapconfig', function() {

    test('can not create mapconfig with invalid version', function(done) {
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

    test('can not create mapconfig with no options in layer', function(done) {
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

    test('interactivity array gets converted into comma joined string', function(done) {
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

});

