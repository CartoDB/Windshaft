'use strict';

require('../support/test_helper');

var assert = require('../support/assert');
var TestClient = require('../support/test_client');

// Note: this is an indirect way of checking whether the caches are
// enabled, but it is way better than other approaches: modify configs
// and restart the server, add printfs and other debug traces, etc.
describe('markers_symbolizer_caches config', function() {

    var FORMAT = "png";
    var MAPCONFIG =  {
        version: '1.2.0',
        layers: [
            {
                type: 'mapnik',
                options: {
                    sql: "SELECT 1 AS cartodb_id, " +
                        " ST_SetSRID(ST_MakePoint(3.609695,37.182749),4326)" +
                        " AS the_geom_webmercator",
                    geom_column: 'the_geom_webmercator',
                    cartocss: '#layer { marker-width: 7; marker-fill: #4dee83; }',
                    cartocss_version: '2.0.1'
                }
            }
        ]
    };

    it("gets mapnik metrics from markers symbolizer caches by default", function(done) {
        var options = {
            mapnik: {
                mapnik: {
                    metrics : true
                }
            }
        };

        var testClient = new TestClient(MAPCONFIG, options);

        testClient.getTile(0, 0, 0, {format: FORMAT}, function(err, tile, img, headers, stats) {
            assert.ifError(err);
            assert.equal(stats.hasOwnProperty('Mk_Agg_PMS_ImageCache_Miss'), true);
            assert.equal(stats.hasOwnProperty('Mk_Agg_PMS_ImageCache_Ignored'), false);
            done();
        });
    });

    it("does not get mapnik metrics from markers symbolizer caches when explicitly disabled", function(done) {
        var options = {
            mapnik: {
                mapnik: {
                    metrics : true,
                    markers_symbolizer_caches: {
                        disabled: true
                    }
                }
            }
        };

        var testClient = new TestClient(MAPCONFIG, options);
        testClient.getTile(0, 0, 0, {format: FORMAT}, function(err, tile, img, headers, stats) {
            assert.ifError(err);
            assert.equal(stats.hasOwnProperty('Mk_Agg_PMS_ImageCache_Miss'), false);
            assert.equal(stats.hasOwnProperty('Mk_Agg_PMS_ImageCache_Ignored'), true);
            done();
        });
    });

    it("gets mapnik metrics from markers symbolizer caches when explicitly not disabled", function(done) {
        var options = {
            mapnik: {
                mapnik: {
                    metrics : true,
                    markers_symbolizer_caches: {
                        disabled: false
                    }
                }
            }
        };

        var testClient = new TestClient(MAPCONFIG, options);
        testClient.getTile(0, 0, 0, {format: FORMAT}, function(err, tile, img, headers, stats) {
            assert.ifError(err);
            assert.equal(stats.hasOwnProperty('Mk_Agg_PMS_ImageCache_Miss'), true);
            assert.equal(stats.hasOwnProperty('Mk_Agg_PMS_ImageCache_Ignored'), false);
            done();
        });
    });

});
