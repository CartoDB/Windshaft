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

     describe('Geometry counts', function() {

        it("works with different geometry types", function(done) {

            var mapconfig =  {
                version: '1.2.0',
                layers: [{
                    type: 'mapnik',
                    options: {
                        sql:/* 3 POINTS */
                            "SELECT 11 as c, ST_SetSRID(ST_MakePoint(-71.10434, 42.315),4326) as tgw" +
                            " UNION ALL " +
                            "SELECT 12 as c, ST_SetSRID(ST_MakePoint(-75.10434, 42.315),4326) as tgw" +
                            " UNION ALL " +
                            "SELECT 13 as c, ST_SetSRID(ST_MakePoint(-75.10434, 45.335),4326) as tgw" +

                            /* 2 MULTIPOINTS */
                            " UNION ALL " +
                            "SELECT 21 as c, 'MULTIPOINT((-72.10 44.31), (40.41 -3.70))'::geometry as tgw" +
                            " UNION ALL " +
                            "SELECT 22 as c, 'MULTIPOINT((-73.10 42.31), (40.41 -3.70))'::geometry as tgw" +

                            /* 2 LINESTRINGS */
                            " UNION ALL " +
                            "SELECT 31 as c, ST_MakeLine(" +
                                "ST_SetSRID(ST_MakePoint(-71.10434, 42.315), 4326)," +
                                "ST_SetSRID(ST_MakePoint(-73.10434, 44.315), 4326)) as tgw" +
                            " UNION ALL " +
                            "SELECT 32 as c, ST_MakeLine(" +
                                "ST_SetSRID(ST_MakePoint(-76.10434, 42.315), 4326)," +
                                "ST_SetSRID(ST_MakePoint(-72.10434, 44.315), 4326)) as tgw" +

                            /* 2 MULTILINESTRING */
                            " UNION ALL " +
                            "SELECT 41 as c, ST_Multi(ST_MakeLine(" +
                                "ST_SetSRID(ST_MakePoint(-71.10434, 42.315), 4326)," +
                                "ST_SetSRID(ST_MakePoint(-73.10434, 44.315), 4326))) as tgw" +
                            " UNION ALL " +
                            "SELECT 42 as c, ST_Multi(ST_MakeLine(" +
                                "ST_SetSRID(ST_MakePoint(-76.10434, 42.315), 4326)," +
                                "ST_SetSRID(ST_MakePoint(-72.10434, 44.315), 4326))) as tgw" +

                            /* 4 POLYGONS */
                            " UNION ALL " +
                            "SELECT 51 as c, ST_MakeEnvelope(-100,-40, 100, 40, 4326) as tgw" +
                            " UNION ALL " +
                            "SELECT 52 as c, ST_MakeEnvelope(-100,-45, 100, 40, 4326) as tgw" +
                            " UNION ALL " +
                            "SELECT 53 as c, ST_MakeEnvelope(-100,-45, 120, 40, 4326) as tgw" +
                            " UNION ALL " +
                            "SELECT 54 as c, ST_MakeEnvelope(-100,-45, 100, 44, 4326) as tgw" +

                            /* 3 MUTIPOLYGON */
                            " UNION ALL " +
                            "SELECT 61 as c, ST_Multi(ST_MakeEnvelope(-100,-45, 100, 44, 4326)) as tgw"+
                            " UNION ALL " +
                            "SELECT 62 as c, ST_Multi(ST_MakeEnvelope(-130,-45, 3100, 44, 4326)) as tgw"+
                            " UNION ALL " +
                            "SELECT 63 as c, ST_Multi(ST_MakeEnvelope(-102,-45, 100, 44, 4326)) as tgw" +

                            /* 1 GEOMETRYCOLLECTION */
                            " UNION ALL " +
                            "SELECT 71 as c, "+
                            "'GEOMETRYCOLLECTION(CIRCULARSTRING(22.022 15.040,22.202 15.040,22.022 15.040))" +
                            "'::geometry as tgw",

                        geom_column: 'tgw',
                        cartocss: '#layer { raster-opacity:1.0 }',
                        cartocss_version: '2.0.1'
                    }
                }]
            };

            var testClient = new TestClient(mapconfig, { mapnik : { mapnik : { metrics : true } } });
            testClient.getTile(0, 0, 0, {format: "png"}, function(err, tile, img, headers, stats) {
                assert.ok(!err);
                assert.equal(stats.Mk_Features_cnt_Point, 3);
                assert.equal(stats.Mk_Features_cnt_MultiPoint, 2);
                assert.equal(stats.Mk_Features_cnt_LineString, 2);
                assert.equal(stats.Mk_Features_cnt_MultiLineString, 2);
                assert.equal(stats.Mk_Features_cnt_Polygon, 4);
                assert.equal(stats.Mk_Features_cnt_MultiPolygon, 3);
                assert.equal(stats.Mk_Features_cnt_GeometryCollection, 1);
                done();
            });
        });

        it("shows unknown with raster", function(done) {

            var mapconfig =  {
                version: '1.2.0',
                layers: [{
                    type: 'cartodb',
                    options: {
                        sql: /* 4 RASTERs */
                            "SELECT 81 as c, " +
                            "ST_AsRaster(ST_MakeEnvelope(-100,-40, 100, 40, 4326), 1.0, -1.0, '8BUI', 127) as rst" +
                            " UNION ALL " +
                            "SELECT 82 as c, " +
                            "ST_AsRaster(ST_MakeEnvelope(-100,-45, 100, 40, 4326), 1.0, -1.0, '8BUI', 127) as rst" +
                            " UNION ALL " +
                            "SELECT 83 as c, " +
                            "ST_AsRaster(ST_MakeEnvelope(-100,-45, 120, 40, 4326), 1.0, -1.0, '8BUI', 127) as rst" +
                            " UNION ALL " +
                            "SELECT 84 as c, " +
                            "ST_AsRaster(ST_MakeEnvelope(-100,-45, 100, 44, 4326), 1.0, -1.0, '8BUI', 127) as rst",
                        geom_column: 'rst',
                        geom_type: 'raster',
                        cartocss: '#layer { raster-opacity:1.0 }',
                        cartocss_version: '2.0.1'
                    }
                }]
            };

            var testClient = new TestClient(mapconfig, { mapnik : { mapnik : { metrics : true } } });
            testClient.getTile(0, 0, 0, {format: "png"}, function(err, tile, img, headers, stats) {
                assert.ok(!err);
                assert.equal(stats.Mk_Features_cnt_Unknown, 4);
                done();
            });
        });


});