require('../support/test_helper.js');

var assert = require('assert');
var MapConfig = require('../../lib/windshaft/models/mapconfig');

describe('mapconfig widgets', function() {

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

});

