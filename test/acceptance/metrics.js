require('../support/test_helper');

var assert = require('../support/assert');
var TestClient = require('../support/test_client');

describe('metrics', function() {

    function onTileErrorStrategyPass(err, tile, headers, stats, format, callback) {
        callback(err, tile, headers, stats);
    }

    var ON_TILE_ERROR = [null, onTileErrorStrategyPass];
    var FORMATS = ["png", "png32", "grid.json"];
    ON_TILE_ERROR.forEach(function(strat) {
    FORMATS.forEach(function(format) {
        it("returns Mapnik metrics if requested " +
          "[Strategy: " + (strat ? strat.name : "undefined") + ". Format: " + format + "]", function(done) {

            var mapconfig =  {
                version: '1.2.0',
                layers: [
                    {
                        type: 'mapnik',
                        options: {
                            sql: "select 1 as cartodb_id, " +
                                " ST_MakeEnvelope(-100,-40, 100, 40, 4326) " +
                                " as the_geom_webmercator",
                            geom_column: 'the_geom_webmercator',
                            cartocss: '#layer { raster-opacity:1.0 }',
                            cartocss_version: '2.0.1'
                        }
                    }
                ]
            };

            if (format === "grid.json") {
                delete mapconfig.layers[0].options.geom_column;
                delete mapconfig.layers[0].options.geom_type;
                mapconfig.layers[0].options.interactivity = [ 'cartodb_id' ];
            }

            var testClient = new TestClient(mapconfig, { mapnik : { mapnik : { metrics : true } } }, strat);
            testClient.getTile(0, 0, 0, {format: format}, function(err, tile, img, headers, stats) {
                assert.ok(!err);
                assert(!stats.hasOwnProperty('Mapnik'));
                assert(stats.hasOwnProperty('Mk_Setup'));
                assert(stats.hasOwnProperty('Mk_Render'));
                done();
            });
        });

        it("Doesn't returns Mapnik metrics if set to false " +
           "[Strategy: " + (strat ? strat.name : "undefined") + ". Format: " +format + ")", function(done) {

            var mapconfig =  {
                version: '1.2.0',
                layers: [
                    {
                        type: 'mapnik',
                        options: {
                            sql: "select 1 as cartodb_id, " +
                                " ST_MakeEnvelope(-100,-40, 100, 40, 4326) " +
                                " as the_geom_webmercator",
                            geom_column: 'the_geom_webmercator',
                            cartocss: '#layer { raster-opacity:1.0 }',
                            cartocss_version: '2.0.1'
                        }
                    }
                ]
            };

            if (format === "grid.json") {
                delete mapconfig.layers[0].options.geom_column;
                delete mapconfig.layers[0].options.geom_type;
                mapconfig.layers[0].options.interactivity = [ 'cartodb_id' ];
            }

            var testClient = new TestClient(mapconfig, { mapnik : { mapnik : { metrics : false } } }, strat);
            testClient.getTile(0, 0, 0, {format: format}, function(err, tile, img, headers, stats) {
                assert.ok(!err);
                assert(!stats.hasOwnProperty('Mapnik'));
                assert(!stats.hasOwnProperty('Mk_Setup'));
                assert(!stats.hasOwnProperty('Mk_Render'));
                done();
            });
        });

        it("Doesn't crash when only part of the metrics are returned " +
           "[Strategy: " + (strat ? strat.name : "undefined") + ". Format: " + format + ")", function(done) {
            // Mapconfig without render for zooms < 10
            var mapconfig =  {
                version: '1.2.0',
                layers: [
                    {
                        type: 'mapnik',
                        options: {
                            sql: "select 1 as cartodb_id, ST_AsRaster(" +
                                " ST_MakeEnvelope(-100,-40, 100, 40, 4326), " +
                                " 1.0, -1.0, '8BUI', 127) as the_geom_webmercator",
                            geom_column: 'the_geom_webmercator',
                            geom_type: 'raster',
                            cartocss: '#query_test[zoom >= 10] {#layer { raster-opacity:1.0 }}',
                            cartocss_version: '2.0.1'
                        }
                    }
                ]
            };

            if (format === "grid.json") {
                delete mapconfig.layers[0].options.geom_column;
                delete mapconfig.layers[0].options.geom_type;
                mapconfig.layers[0].options.interactivity = [ 'cartodb_id' ];
            }

            var testClient = new TestClient(mapconfig, { mapnik : { mapnik : { metrics : true } } }, strat);
            testClient.getTile(0, 0, 0, {format: format}, function(err, tile, img, headers, stats) {
                assert.ok(!err);
                assert(!stats.hasOwnProperty('Mapnik'));
                assert(stats.hasOwnProperty('Mk_Setup'));
                assert(!stats.hasOwnProperty('Mk_Render'));
                done();
            });

        });

    });
    });
});