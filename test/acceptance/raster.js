require('../support/test_helper');

var assert = require('../support/assert');
var TestClient = require('../support/test_client');

describe('raster', function() {

    var IMAGE_EQUALS_TOLERANCE_PER_MIL = 2;

    it("can render raster for valid mapconfig", function(done) {

        var mapconfig =  {
            version: '1.2.0',
            layers: [
                {
                    type: 'mapnik',
                    options: {
                        sql: "select ST_AsRaster(" +
                            " ST_MakeEnvelope(-100,-40, 100, 40, 4326), " +
                            " 1.0, -1.0, '8BUI', 127) as rst",
                        geom_column: 'rst',
                        geom_type: 'raster',
                        cartocss: '#layer { raster-opacity:1.0 }',
                        cartocss_version: '2.0.1'
                    }
                }
            ]
        };

        var testClient = new TestClient(mapconfig);
        testClient.getTile(0, 0, 0, function(err, tile) {
            assert.ok(!err);
            assert.imageEqualsFile(tile, './test/fixtures/raster_gray_rect.png', IMAGE_EQUALS_TOLERANCE_PER_MIL, done);
        });

    });

    it("raster geom type does not allow interactivity", function(done) {

        var mapconfig =  {
            version: '1.2.0',
            layers: [
                {
                    type: 'cartodb',
                    options: {
                        sql: [
                                "select 1 id,",
                                "ST_AsRaster(ST_MakeEnvelope(-100, -40, 100, 40, 4326), 1.0, -1.0, '8BUI', 127) as rst"
                        ].join(' '),
                        geom_column: 'rst',
                        geom_type: 'raster',
                        cartocss: '#layer { raster-opacity: 1.0 }',
                        cartocss_version: '2.0.1',
                        interactivity: 'id'
                    }
                }
            ]
        };

        var testClient = new TestClient(mapconfig);
        testClient.getTile(0, 0, 0, function(err) {
            assert.ok(err);
            assert.equal(err.message, 'Mapnik raster layers do not support interactivity');
            done();
        });
    });

    it("raster geom type allows to set raster_band", function(done) {

        var mapconfig =  {
            version: '1.2.0',
            layers: [
                {
                    type: 'cartodb',
                    options: {
                        sql: [
                            "select 1 id,",
                            "ST_AsRaster(ST_MakeEnvelope(-100, -40, 100, 40, 4326), 1.0, -1.0, '8BUI', 127) as rst"
                        ].join(' '),
                        cartocss_version: '2.3.0',
                        cartocss: '#layer { raster-opacity: 1.0 }',
                        geom_column: 'rst',
                        geom_type: 'raster',
                        raster_band: 1
                    }
                }
            ]
        };

        var testClient = new TestClient(mapconfig);
        testClient.getTile(0, 0, 0, function(err, tile, img) {
            assert.ok(!err);
            assert.ok(tile);
            assert.equal(img.width(), 256);
            done();
        });
    });


    function onTileErrorStrategyPass(err, tile, headers, stats, format, callback) {
        callback(err, tile, headers, stats);
    }

    var ON_TILE_ERROR = [null, onTileErrorStrategyPass];
    var FORMATS = ["png", "png32", "grid.json"];
    ON_TILE_ERROR.forEach(function(strat) {
    FORMATS.forEach(function(format) {
        it("returns Mapnik metrics if requested " +
          "[Strategy: " + (strat ? strat.name : "undefined") + ". Format: " + format + ")", function(done) {

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
                assert(!stats.Mapnik);
                assert(stats.Mk_Setup);
                assert(stats.Mk_Render);
                assert(stats.Mk_FeatNum);
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
                            sql: "select 1 as cartodb_id, ST_AsRaster(" +
                                " ST_MakeEnvelope(-100,-40, 100, 40, 4326), " +
                                " 1.0, -1.0, '8BUI', 127) as the_geom_webmercator",
                            geom_column: 'the_geom_webmercator',
                            geom_type: 'raster',
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
                assert(!stats.Mapnik);
                assert(!stats.Mk_Setup);
                assert(!stats.Mk_Render);
                assert(!stats.Mk_FeatNum);
                done();
            });
        });
    });
    });
});

