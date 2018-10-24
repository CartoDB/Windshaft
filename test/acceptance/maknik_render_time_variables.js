'use strict';

require('../support/test_helper');

var assert = require('../support/assert');
var TestClient = require('../support/test_client');

describe('layer filtering', function() {
    var IMG_TOLERANCE_PER_MIL = 20;

    var mapConfig = {
        version: '1.2.0',
        layers: [
            {
                type: 'mapnik',
                options: {
                    sql: 'SELECT * FROM populated_places_simple_reduced ORDER BY cartodb_id LIMIT !@RENDERLIMIT!',
                    cartocss: "#layer { marker-width: 2; marker-fill:'@RENDERCOLOR' }",
                    geom_column: 'the_geom',
                    cartocss_version: '2.0.1'
                }
            }
        ]
    };

    var TEST_COLORS = ["red", "blue", "green"];
    var TEST_LIMITS = [10, 100, 1000];

    function getAssertFilepath(color, limit) {
        return './test/fixtures/variables/populated_places_' +  color + '_' + limit + '_0.0.0.png';
    }

    TEST_COLORS.forEach(function(color) {
    TEST_LIMITS.forEach(function(limit) {

        it('Variables in mapconfig - should render with ' + color + ' LIMIT ' + limit, function (done) {
            var overriddenOptions = {
                mapnik : {
                    mapnik : {
                        metrics : true,
                        markers_symbolizer_caches : {
                            disabled : false
                        },
                        variables : {
                            'RENDERLIMIT' : limit,
                            'RENDERCOLOR' : color
                        }
                    }
                }
            };

            var testClient = new TestClient(mapConfig, overriddenOptions);
            testClient.getTile(0, 0, 0, {format: "png"}, function(err, tile) {
                assert.ifError(err);
                var filepath = getAssertFilepath(color, limit);

                assert.imageEqualsFile(tile, filepath, IMG_TOLERANCE_PER_MIL, function(err) {
                    assert.ifError(err);
                    done();
                });
            });
        });

        //There isn't support for this yet (https://github.com/CartoDB/Windshaft/issues/613)
        it.skip('Variables in getTile - should render with ' + color + ' LIMIT ' + limit, function (done) {
            var overriddenOptions = {
                format: "png",
                variables : {
                    'RENDERLIMIT' : limit,
                    'RENDERCOLOR' : color
                }
            };

            var testClient = new TestClient(mapConfig);
            testClient.getTile(0, 0, 0, overriddenOptions, function(err, tile) {
                assert.ifError(err);
                var filepath = getAssertFilepath(color, limit);

                assert.imageEqualsFile(tile, filepath, IMG_TOLERANCE_PER_MIL, function(err) {
                    assert.ifError(err);
                    done();
                });
            });
        });
    });
    });
});
