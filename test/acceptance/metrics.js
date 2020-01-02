'use strict';

require('../support/test_helper');

var assert = require('../support/assert');
var TestClient = require('../support/test_client');
var fs = require('fs');
var http = require('http');
const path = require('path');

describe('metrics', function () {
    function onTileErrorStrategyPass (err, tile, headers, stats, format, callback) {
        callback(err, tile, headers, stats);
    }

    var ON_TILE_ERROR = [null, onTileErrorStrategyPass];
    var FORMATS = ['png', 'png32', 'grid.json'];
    ON_TILE_ERROR.forEach(function (strat) {
        FORMATS.forEach(function (format) {
            it('returns Mapnik metrics if requested ' +
          '[Strategy: ' + (strat ? strat.name : 'undefined') + '. Format: ' + format + ']', function (done) {
                var mapconfig = {
                    version: '1.2.0',
                    layers: [
                        {
                            type: 'mapnik',
                            options: {
                                sql: 'select 1 as cartodb_id, ' +
                                ' ST_MakeEnvelope(-100,-40, 100, 40, 4326) ' +
                                ' as the_geom_webmercator',
                                geom_column: 'the_geom_webmercator',
                                cartocss: '#layer { raster-opacity:1.0 }',
                                cartocss_version: '2.0.1'
                            }
                        }
                    ]
                };

                if (format === 'grid.json') {
                    delete mapconfig.layers[0].options.geom_column;
                    delete mapconfig.layers[0].options.geom_type;
                    mapconfig.layers[0].options.interactivity = ['cartodb_id'];
                }

                var testClient = new TestClient(mapconfig, { mapnik: { mapnik: { metrics: true } } }, strat);
                testClient.getTile(0, 0, 0, { format: format }, function (err, tile, img, headers, stats) {
                    assert.ifError(err);
                    assert(!Object.prototype.hasOwnProperty.call(stats, 'Mapnik'));
                    assert(Object.prototype.hasOwnProperty.call(stats, 'Mk_Setup'));
                    assert(Object.prototype.hasOwnProperty.call(stats, 'Mk_Render'));
                    done();
                });
            });

            it("Doesn't returns Mapnik metrics if set to false " +
           '[Strategy: ' + (strat ? strat.name : 'undefined') + '. Format: ' + format + ')', function (done) {
                var mapconfig = {
                    version: '1.2.0',
                    layers: [
                        {
                            type: 'mapnik',
                            options: {
                                sql: 'select 1 as cartodb_id, ' +
                                ' ST_MakeEnvelope(-100,-40, 100, 40, 4326) ' +
                                ' as the_geom_webmercator',
                                geom_column: 'the_geom_webmercator',
                                cartocss: '#layer { raster-opacity:1.0 }',
                                cartocss_version: '2.0.1'
                            }
                        }
                    ]
                };

                if (format === 'grid.json') {
                    delete mapconfig.layers[0].options.geom_column;
                    delete mapconfig.layers[0].options.geom_type;
                    mapconfig.layers[0].options.interactivity = ['cartodb_id'];
                }

                var testClient = new TestClient(mapconfig, { mapnik: { mapnik: { metrics: false } } }, strat);
                testClient.getTile(0, 0, 0, { format: format }, function (err, tile, img, headers, stats) {
                    assert.ifError(err);
                    assert(!Object.prototype.hasOwnProperty.call(stats, 'Mapnik'));
                    assert(!Object.prototype.hasOwnProperty.call(stats, 'Mk_Setup'));
                    assert(!Object.prototype.hasOwnProperty.call(stats, 'Mk_Render'));
                    done();
                });
            });

            it("Doesn't crash when only part of the metrics are returned " +
           '[Strategy: ' + (strat ? strat.name : 'undefined') + '. Format: ' + format + ')', function (done) {
            // Mapconfig without render for zooms < 10
                var mapconfig = {
                    version: '1.2.0',
                    layers: [
                        {
                            type: 'mapnik',
                            options: {
                                sql: 'select 1 as cartodb_id, ST_AsRaster(' +
                                ' ST_MakeEnvelope(-100,-40, 100, 40, 4326), ' +
                                " 1.0, -1.0, '8BUI', 127) as the_geom_webmercator",
                                geom_column: 'the_geom_webmercator',
                                geom_type: 'raster',
                                cartocss: '#query_test[zoom >= 10] {#layer { raster-opacity:1.0 }}',
                                cartocss_version: '2.0.1'
                            }
                        }
                    ]
                };

                if (format === 'grid.json') {
                    delete mapconfig.layers[0].options.geom_column;
                    delete mapconfig.layers[0].options.geom_type;
                    mapconfig.layers[0].options.interactivity = ['cartodb_id'];
                }

                var testClient = new TestClient(mapconfig, { mapnik: { mapnik: { metrics: true } } }, strat);
                testClient.getTile(0, 0, 0, { format: format }, function (err, tile, img, headers, stats) {
                    assert.ifError(err);
                    assert(!Object.prototype.hasOwnProperty.call(stats, 'Mapnik'));
                    assert(Object.prototype.hasOwnProperty.call(stats, 'Mk_Setup'));
                    assert(!Object.prototype.hasOwnProperty.call(stats, 'Mk_Render'));
                    done();
                });
            });
        });
    });

    it('works with metatiles', function (done) {
        var mapconfig = {
            version: '1.2.0',
            layers: [
                {
                    type: 'mapnik',
                    options: {
                        sql: 'select 1 as cartodb_id, ' +
                            ' ST_MakeEnvelope(-100,-40, 100, 40, 4326) ' +
                            ' as the_geom_webmercator',
                        geom_column: 'the_geom_webmercator',
                        cartocss: '#layer { raster-opacity:1.0 }',
                        cartocss_version: '2.0.1'
                    }
                }
            ]
        };

        var testClient = new TestClient(mapconfig, { mapnik: { mapnik: { metatile: 2, metrics: true } } });
        testClient.getTile(1, 1, 1, { format: 'png' }, function (err, tile, img, headers, stats) {
            assert.ifError(err);
            assert(!Object.prototype.hasOwnProperty.call(stats, 'Mapnik'));
            assert(Object.prototype.hasOwnProperty.call(stats, 'Mk_Setup'));
            assert(Object.prototype.hasOwnProperty.call(stats, 'Mk_Render'));
            done();
        });
    });

    describe('Geometry counts', function () {
        it('works with different geometry types', function (done) {
            var mapconfig = {
                version: '1.2.0',
                layers: [{
                    type: 'mapnik',
                    options: {
                        sql: /* 3 POINTS */
                            'SELECT 11 as c, ST_SetSRID(ST_MakePoint(-71.10434, 42.315),4326) as tgw' +
                            ' UNION ALL ' +
                            'SELECT 12 as c, ST_SetSRID(ST_MakePoint(-75.10434, 42.315),4326) as tgw' +
                            ' UNION ALL ' +
                            'SELECT 13 as c, ST_SetSRID(ST_MakePoint(-75.10434, 45.335),4326) as tgw' +

                            /* 2 MULTIPOINTS */
                            ' UNION ALL ' +
                            "SELECT 21 as c, 'MULTIPOINT((-72.10 44.31), (40.41 -3.70))'::geometry as tgw" +
                            ' UNION ALL ' +
                            "SELECT 22 as c, 'MULTIPOINT((-73.10 42.31), (40.41 -3.70))'::geometry as tgw" +

                            /* 2 LINESTRINGS */
                            ' UNION ALL ' +
                            'SELECT 31 as c, ST_MakeLine(' +
                                'ST_SetSRID(ST_MakePoint(-71.10434, 42.315), 4326),' +
                                'ST_SetSRID(ST_MakePoint(-73.10434, 44.315), 4326)) as tgw' +
                            ' UNION ALL ' +
                            'SELECT 32 as c, ST_MakeLine(' +
                                'ST_SetSRID(ST_MakePoint(-76.10434, 42.315), 4326),' +
                                'ST_SetSRID(ST_MakePoint(-72.10434, 44.315), 4326)) as tgw' +

                            /* 2 MULTILINESTRING */
                            ' UNION ALL ' +
                            'SELECT 41 as c, ST_Multi(ST_MakeLine(' +
                                'ST_SetSRID(ST_MakePoint(-71.10434, 42.315), 4326),' +
                                'ST_SetSRID(ST_MakePoint(-73.10434, 44.315), 4326))) as tgw' +
                            ' UNION ALL ' +
                            'SELECT 42 as c, ST_Multi(ST_MakeLine(' +
                                'ST_SetSRID(ST_MakePoint(-76.10434, 42.315), 4326),' +
                                'ST_SetSRID(ST_MakePoint(-72.10434, 44.315), 4326))) as tgw' +

                            /* 4 POLYGONS */
                            ' UNION ALL ' +
                            'SELECT 51 as c, ST_MakeEnvelope(-100,-40, 100, 40, 4326) as tgw' +
                            ' UNION ALL ' +
                            'SELECT 52 as c, ST_MakeEnvelope(-100,-45, 100, 40, 4326) as tgw' +
                            ' UNION ALL ' +
                            'SELECT 53 as c, ST_MakeEnvelope(-100,-45, 120, 40, 4326) as tgw' +
                            ' UNION ALL ' +
                            'SELECT 54 as c, ST_MakeEnvelope(-100,-45, 100, 44, 4326) as tgw' +

                            /* 3 MUTIPOLYGON */
                            ' UNION ALL ' +
                            'SELECT 61 as c, ST_Multi(ST_MakeEnvelope(-100,-45, 100, 44, 4326)) as tgw' +
                            ' UNION ALL ' +
                            'SELECT 62 as c, ST_Multi(ST_MakeEnvelope(-130,-45, 3100, 44, 4326)) as tgw' +
                            ' UNION ALL ' +
                            'SELECT 63 as c, ST_Multi(ST_MakeEnvelope(-102,-45, 100, 44, 4326)) as tgw' +

                            /* 1 GEOMETRYCOLLECTION */
                            ' UNION ALL ' +
                            'SELECT 71 as c, ' +
                            "'GEOMETRYCOLLECTION(CIRCULARSTRING(22.022 15.040,22.202 15.040,22.022 15.040))" +
                            "'::geometry as tgw",

                        geom_column: 'tgw',
                        cartocss: '#layer { raster-opacity:1.0 }',
                        cartocss_version: '2.0.1'
                    }
                }]
            };

            var testClient = new TestClient(mapconfig, { mapnik: { mapnik: { metrics: true } } });
            testClient.getTile(0, 0, 0, { format: 'png' }, function (err, tile, img, headers, stats) {
                assert.ifError(err);
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

        it('shows unknown with raster', function (done) {
            var mapconfig = {
                version: '1.2.0',
                layers: [{
                    type: 'cartodb',
                    options: {
                        sql: /* 4 RASTERs */
                            'SELECT 81 as c, ' +
                            "ST_AsRaster(ST_MakeEnvelope(-100,-40, 100, 40, 4326), 1.0, -1.0, '8BUI', 127) as rst" +
                            ' UNION ALL ' +
                            'SELECT 82 as c, ' +
                            "ST_AsRaster(ST_MakeEnvelope(-100,-45, 100, 40, 4326), 1.0, -1.0, '8BUI', 127) as rst" +
                            ' UNION ALL ' +
                            'SELECT 83 as c, ' +
                            "ST_AsRaster(ST_MakeEnvelope(-100,-45, 120, 40, 4326), 1.0, -1.0, '8BUI', 127) as rst" +
                            ' UNION ALL ' +
                            'SELECT 84 as c, ' +
                            "ST_AsRaster(ST_MakeEnvelope(-100,-45, 100, 44, 4326), 1.0, -1.0, '8BUI', 127) as rst",
                        geom_column: 'rst',
                        geom_type: 'raster',
                        cartocss: '#layer { raster-opacity:1.0 }',
                        cartocss_version: '2.0.1'
                    }
                }]
            };

            var testClient = new TestClient(mapconfig, { mapnik: { mapnik: { metrics: true } } });
            testClient.getTile(0, 0, 0, { format: 'png' }, function (err, tile, img, headers, stats) {
                assert.ifError(err);
                assert.equal(stats.Mk_Features_cnt_Unknown, 4);
                done();
            });
        });
    });

    // NOTE: Since the tests are run in the same process and the cache is global
    // make sure to have an unique cartocss style per test to avoid interferences
    describe('Render marker symbolizer - Attributes cache', function () {
        var overriddenOptions = {
            mapnik: {
                mapnik: {
                    metrics: true,
                    markers_symbolizer_caches: {
                        disabled: false
                    },
                    variables: {
                        'cdb-width': 10,
                        Series_Size: 5
                    }
                }
            }
        };

        it('counts correctly with standard cartocss', function (done) {
            var mapconfig = {
                version: '1.2.0',
                layers: [{
                    type: 'mapnik',
                    options: {
                        /* 10 points */
                        sql: 'SELECT row_number() over() as cartodb_id, ' +
                            'ST_SetSRID(ST_MakePoint(3.609695,37.182749),4326) AS the_geom_webmercator ' +
                            'FROM generate_series(1, 10) qseries',
                        geom_column: 'the_geom_webmercator',
                        /* All points with the using the marker symbolizer */
                        cartocss: '#layer { marker-width: 1; marker-fill: #4dee83; }',
                        cartocss_version: '2.0.1'
                    }
                }]
            };

            var testClient = new TestClient(mapconfig, overriddenOptions);
            testClient.getTile(0, 0, 0, { format: 'png' }, function (err, tile, img, headers, stats) {
                assert.ifError(err);
                assert.equal(stats.Mk_Features_cnt_Point, 10);
                assert.equal(stats.Mk_Agg_PMS_AttrCache_Miss, 1);
                done();
            });
        });

        it('counts correctly with variable sql', function (done) {
            var mapconfig = {
                version: '1.2.0',
                layers: [{
                    type: 'mapnik',
                    options: {
                        /* 10 points */
                        sql: 'SELECT row_number() over() as cartodb_id, ' +
                            'ST_SetSRID(ST_MakePoint(3.609695,37.182749),4326) AS the_geom_webmercator ' +
                            'FROM generate_series(1, !@Series_Size!) qseries',
                        geom_column: 'the_geom_webmercator',
                        /* All points with the using the marker symbolizer */
                        cartocss: '#layer { marker-width: 2; marker-fill: #4dee83; }',
                        cartocss_version: '2.0.1'
                    }
                }]
            };

            var testClient = new TestClient(mapconfig, overriddenOptions);
            testClient.getTile(0, 0, 0, { format: 'png' }, function (err, tile, img, headers, stats) {
                assert.ifError(err);
                assert.equal(stats.Mk_Features_cnt_Point, 5);
                assert.equal(stats.Mk_Agg_PMS_AttrCache_Miss, 1);
                done();
            });
        });

        it('counts as misses with uncacheable attributes', function (done) {
            var mapconfig = {
                version: '1.2.0',
                layers: [{
                    type: 'mapnik',
                    options: {
                        /* 10 points */
                        sql: 'SELECT row_number() over() as cartodb_id, ' +
                            'ST_SetSRID(ST_MakePoint(3.609695,37.182749),4326) AS the_geom_webmercator ' +
                            'FROM generate_series(1, 10) qseries',
                        geom_column: 'the_geom_webmercator',
                        /* The style has a variable */
                        cartocss: "#layer { marker-width: '@cdb-width'; marker-fill: #4dee83; }",
                        cartocss_version: '2.0.1'
                    }
                }]
            };

            var testClient = new TestClient(mapconfig, overriddenOptions);
            testClient.getTile(0, 0, 0, { format: 'png' }, function (err, tile, img, headers, stats) {
                assert.ifError(err);
                assert.equal(stats.Mk_Features_cnt_Point, 10);
                assert.equal(stats.Mk_Agg_PMS_AttrCache_Miss, 10);
                done();
            });
        });

        it('counts ellipse cache misses', function (done) {
            var mapconfig = {
                version: '1.2.0',
                layers: [{
                    type: 'mapnik',
                    options: {
                        /* 10 points */
                        sql: 'SELECT row_number() over() as cartodb_id, ' +
                            'ST_SetSRID(ST_MakePoint(3.609695,37.182749),4326) AS the_geom_webmercator ' +
                            'FROM generate_series(1, 10) qseries',
                        geom_column: 'the_geom_webmercator',
                        /* All points with the using the marker symbolizer */
                        cartocss: '#layer { marker-width: 4; marker-fill: #4de383; }',
                        cartocss_version: '2.0.1'
                    }
                }]
            };

            var testClient = new TestClient(mapconfig, overriddenOptions);
            testClient.getTile(0, 0, 0, { format: 'png' }, function (err, tile, img, headers, stats) {
                assert.ifError(err);
                assert.equal(stats.Mk_Features_cnt_Point, 10);
                assert.equal(stats.Mk_Agg_PMS_AttrCache_Miss, 1);
                assert.equal(stats.Mk_Agg_PMS_EllipseCache_Miss, 1);
                done();
            });
        });

        it("Doesn't use ellipse cache when using arrow markers", function (done) {
            var mapconfig = {
                version: '1.2.0',
                layers: [{
                    type: 'mapnik',
                    options: {
                        /* 2 lines */
                        sql: 'SELECT 31 as c, ST_MakeLine(' +
                                'ST_SetSRID(ST_MakePoint(-71.10434, 42.315), 4326),' +
                                'ST_SetSRID(ST_MakePoint(-73.10434, 44.315), 4326)) as the_geom_webmercator' +
                            ' UNION ALL ' +
                            'SELECT 32 as c, ST_MakeLine(' +
                                'ST_SetSRID(ST_MakePoint(-76.10434, 42.315), 4326),' +
                                'ST_SetSRID(ST_MakePoint(-72.10434, 44.315), 4326)) as the_geom_webmercator',
                        geom_column: 'the_geom_webmercator',
                        /* All points with the using the marker symbolizer */
                        cartocss: '#layer { marker-width: 5; marker-fill: #4de383; marker-type: arrow }',
                        cartocss_version: '2.0.1'
                    }
                }]
            };

            var testClient = new TestClient(mapconfig, overriddenOptions);
            testClient.getTile(0, 0, 0, { format: 'png' }, function (err, tile, img, headers, stats) {
                assert.ifError(err);
                assert.equal(stats.Mk_Features_cnt_LineString, 2);
                assert(!Object.prototype.hasOwnProperty.call(stats, 'Mk_Agg_PMS_EllipseCache_Miss'));
                done();
            });
        });

        it("Doesn't use ellipse cache when using custom markers", function (done) {
            var resourcesServer = http.createServer(function (request, response) {
                var filename = path.join(__dirname, '/../fixtures/markers' + request.url);
                fs.readFile(filename, 'binary', function (err, file) {
                    if (err) {
                        response.writeHead(404, { 'Content-Type': 'text/plain' });
                        response.write('404 Not Found\n');
                    } else {
                        response.writeHead(200);
                        response.write(file, 'binary');
                    }
                    response.end();
                });
            });
            resourcesServer.listen(8083);
            this.markerFileUrl = 'http://localhost:8083/maki/circle-24.png';

            var mapconfig = {
                version: '1.2.0',
                layers: [{
                    type: 'mapnik',
                    options: {
                        /* 10 points */
                        sql: 'SELECT row_number() over() as cartodb_id, ' +
                            'ST_SetSRID(ST_MakePoint(3.609695,37.182749),4326) AS the_geom_webmercator ' +
                            'FROM generate_series(1, 10) qseries',
                        geom_column: 'the_geom_webmercator',
                        /* All points with the using the marker symbolizer */
                        cartocss: "#layer { marker-type:'ellipse'; marker-file: url(" + this.markerFileUrl + ')}',
                        cartocss_version: '2.0.1'
                    }
                }]
            };

            var testClient = new TestClient(mapconfig, overriddenOptions);
            testClient.getTile(0, 0, 0, { format: 'png' }, function (err, tile, img, headers, stats) {
                assert.ifError(err);
                assert.equal(stats.Mk_Features_cnt_Point, 10);
                assert(!Object.prototype.hasOwnProperty.call(stats, 'Mk_Agg_PMS_EllipseCache_Miss'));
                resourcesServer.close(done);
            });
        });
    });

    describe('Render marker symbolizer - Image cache', function () {
        it('counts correctly with standard cartocss', function (done) {
            var mapconfig = {
                version: '1.2.0',
                layers: [{
                    type: 'mapnik',
                    options: {
                        /* 10 points */
                        sql: 'SELECT row_number() over() as cartodb_id, ' +
                            'ST_SetSRID(ST_MakePoint(3.609695,37.182749),4326) AS the_geom_webmercator ' +
                            'FROM generate_series(1, 10) qseries',
                        geom_column: 'the_geom_webmercator',
                        /* All points with the using the marker symbolizer */
                        cartocss: '#layer { marker-width: 1; marker-fill: #4dee83 }',
                        cartocss_version: '2.0.1'
                    }
                }]
            };

            var testClient = new TestClient(mapconfig, { mapnik: { mapnik: { metrics: true } } });
            testClient.getTile(0, 0, 0, { format: 'png' }, function (err, tile, img, headers, stats) {
                assert.ifError(err);
                assert.equal(stats.Mk_Features_cnt_Point, 10);
                assert.equal(stats.Mk_Agg_PMS_ImageCache_Miss, 1);
                done();
            });
        });

        it("counts as ignored if the image isn't cacheable (scaling on)", function (done) {
            var mapconfig = {
                version: '1.2.0',
                layers: [{
                    type: 'mapnik',
                    options: {
                        /* 10 points */
                        sql: 'SELECT 11 as c, ST_SetSRID(ST_MakePoint(-71.10434, 42.315),4326) as tgw' +
                            ' UNION ALL ' +
                            'SELECT 12 as c, ST_SetSRID(ST_MakePoint(-75.10434, 42.315),4326) as tgw' +
                            ' UNION ALL ' +
                            'SELECT 13 as c, ST_SetSRID(ST_MakePoint(-75.10434, 45.335),4326) as tgw',
                        geom_column: 'tgw',
                        /* All points with the using the marker symbolizer */
                        cartocss: '#layer { marker-width: 1; marker-fill: #4dee83; marker-transform:scale(2,2) }',
                        cartocss_version: '2.0.1'
                    }
                }]
            };

            var testClient = new TestClient(mapconfig, { mapnik: { mapnik: { metrics: true } } });
            testClient.getTile(0, 0, 0, { format: 'png' }, function (err, tile, img, headers, stats) {
                assert.ifError(err);
                assert.equal(stats.Mk_Features_cnt_Point, 3);
                assert.equal(stats.Mk_Agg_PMS_ImageCache_Ignored, 3);
                done();
            });
        });
    });

    describe('Per symbolizer', function () {
        var resourcesServer;

        before(function (done) {
            resourcesServer = http.createServer(function (request, response) {
                var filename = path.join(__dirname, '/../fixtures/markers' + request.url);
                fs.readFile(filename, 'binary', function (err, file) {
                    if (err) {
                        response.writeHead(404, { 'Content-Type': 'text/plain' });
                        response.write('404 Not Found\n');
                    } else {
                        response.writeHead(200);
                        response.write(file, 'binary');
                    }
                    response.end();
                });
            });
            resourcesServer.listen(8083, done);
            this.markerFileUrl = 'http://localhost:8083/maki/circle-24.png';
        });

        after(function (done) {
            resourcesServer.close(done);
        });

        var RENDERERS = ['Agg', 'Grid'];
        RENDERERS.forEach(function (renderer) {
            var format = (renderer === 'Agg' ? 'png' : 'grid.json');
            describe(renderer + ' renderer', function () {
                it('Building symbolizer', function (done) {
                    var mapconfig = {
                        version: '1.2.0',
                        layers: [{
                            type: 'mapnik',
                            options: {
                                /* 3d POLYGON */
                                sql: 'SELECT 1 as cartodb_id, ' +
                                    "ST_Polygon(ST_GeomFromEWKT('" +
                                    "LINESTRING(75.15 29.53 1,77 29 1,77.6 29.5 1, 75.15 29.53 1)'), 4326) " +
                                    'AS the_geom_webmercator',
                                geom_column: 'the_geom_webmercator',
                                cartocss: '#layer { building-fill: #4dee83 }',
                                cartocss_version: '2.0.1',
                                interactivity: (renderer === 'Agg' ? undefined : 'cartodb_id')
                            }
                        }]
                    };

                    var testClient = new TestClient(mapconfig, { mapnik: { mapnik: { metrics: true } } });
                    testClient.getTile(0, 0, 0, { format: format }, function (err, tile, img, headers, stats) {
                        assert.ifError(err);
                        assert(Object.prototype.hasOwnProperty.call(stats, 'Mk_Agg_PBuildS') || Object.prototype.hasOwnProperty.call(stats, 'Mk_Grid_PBuildS'));
                        done();
                    });
                });

                // Dot symbolizer isn't available for grid.json format
                if (renderer === 'Agg') {
                    it('Dot symbolizer', function (done) {
                        var mapconfig = {
                            version: '1.2.0',
                            layers: [{
                                type: 'mapnik',
                                options: {
                                    /* 10 points */
                                    sql: 'SELECT row_number() over() as cartodb_id, ' +
                                        'ST_SetSRID(ST_MakePoint(3.609695,37.182749),4326) AS the_geom_webmercator ' +
                                        'FROM generate_series(1, 10) qseries',
                                    geom_column: 'the_geom_webmercator',
                                    cartocss: '#layer { dot-width: 1; dot-fill: #4dee83 }',
                                    cartocss_version: '2.0.1'
                                }
                            }]
                        };

                        var testClient = new TestClient(mapconfig, { mapnik: { mapnik: { metrics: true } } });
                        testClient.getTile(0, 0, 0, { format: format }, function (err, tile, img, headers, stats) {
                            assert.ifError(err);
                            assert(Object.prototype.hasOwnProperty.call(stats, 'Mk_Agg_PDotS'));
                            done();
                        });
                    });
                }

                // Currently unsupported (https://github.com/mapbox/carto/pull/349)
                it.skip('Group symbolizer', function (done) {
                    var mapconfig = {
                        version: '1.2.0',
                        layers: [{
                            type: 'mapnik',
                            options: {
                                /* 10 points */
                                sql: 'SELECT row_number() over() as cartodb_id, ' +
                                    'ST_SetSRID(ST_MakePoint(3.609695,37.182749),4326) AS the_geom_webmercator ' +
                                    'FROM generate_series(1, 10) qseries',
                                geom_column: 'the_geom_webmercator',
                                cartocss: '#layer { group-num-columns: 3}',
                                cartocss_version: '2.0.1',
                                interactivity: (renderer === 'Agg' ? undefined : 'cartodb_id')
                            }
                        }]
                    };

                    var testClient = new TestClient(mapconfig, { mapnik: { mapnik: { metrics: true } } });
                    testClient.getTile(0, 0, 0, { format: format }, function (err, tile, img, headers, stats) {
                        assert.ifError(err);
                        assert(Object.prototype.hasOwnProperty.call(stats, 'Mk_Agg_PGroupS') || Object.prototype.hasOwnProperty.call(stats, 'Mk_Grid_PGroupS'));
                        done();
                    });
                });

                it('Line pattern symbolizer', function (done) {
                    var mapconfig = {
                        version: '1.2.0',
                        layers: [{
                            type: 'mapnik',
                            options: {
                                /* 2 lines */
                                sql: 'SELECT 31 as cartodb_id, ST_MakeLine(' +
                                        'ST_SetSRID(ST_MakePoint(-71.10434, 42.315), 4326),' +
                                        'ST_SetSRID(ST_MakePoint(-73.10434, 44.315), 4326)) as the_geom_webmercator' +
                                    ' UNION ALL ' +
                                    'SELECT 32 as cartodb_id, ST_MakeLine(' +
                                        'ST_SetSRID(ST_MakePoint(-76.10434, 42.315), 4326),' +
                                        'ST_SetSRID(ST_MakePoint(-72.10434, 44.315), 4326)) as the_geom_webmercator',
                                geom_column: 'the_geom_webmercator',
                                cartocss: '#layer { line-pattern-file: url(' + this.markerFileUrl + ')}',
                                cartocss_version: '2.0.1',
                                interactivity: (renderer === 'Agg' ? undefined : 'cartodb_id')
                            }
                        }]
                    };

                    var testClient = new TestClient(mapconfig, { mapnik: { mapnik: { metrics: true } } });
                    testClient.getTile(0, 0, 0, { format: format }, function (err, tile, img, headers, stats) {
                        assert.ifError(err);
                        assert(Object.prototype.hasOwnProperty.call(stats, 'Mk_Agg_PLinePatternS') ||
                               Object.prototype.hasOwnProperty.call(stats, 'Mk_Grid_PLinePatternS'));
                        done();
                    });
                });

                it('Line symbolizer', function (done) {
                    var mapconfig = {
                        version: '1.2.0',
                        layers: [{
                            type: 'mapnik',
                            options: {
                                /* 2 lines */
                                sql: 'SELECT 31 as cartodb_id, ST_MakeLine(' +
                                        'ST_SetSRID(ST_MakePoint(-71.10434, 42.315), 4326),' +
                                        'ST_SetSRID(ST_MakePoint(-73.10434, 44.315), 4326)) as the_geom_webmercator' +
                                    ' UNION ALL ' +
                                    'SELECT 32 as cartodb_id, ST_MakeLine(' +
                                        'ST_SetSRID(ST_MakePoint(-76.10434, 42.315), 4326),' +
                                        'ST_SetSRID(ST_MakePoint(-72.10434, 44.315), 4326)) as the_geom_webmercator',
                                geom_column: 'the_geom_webmercator',
                                cartocss: '#layer { line-width: 3 }',
                                cartocss_version: '2.0.1',
                                interactivity: (renderer === 'Agg' ? undefined : 'cartodb_id')
                            }
                        }]
                    };

                    var testClient = new TestClient(mapconfig, { mapnik: { mapnik: { metrics: true } } });
                    testClient.getTile(0, 0, 0, { format: format }, function (err, tile, img, headers, stats) {
                        assert.ifError(err);
                        assert(Object.prototype.hasOwnProperty.call(stats, 'Mk_Agg_PLineS') || Object.prototype.hasOwnProperty.call(stats, 'Mk_Grid_PLineS'));
                        done();
                    });
                });

                it('Markers symbolizer', function (done) {
                    var mapconfig = {
                        version: '1.2.0',
                        layers: [{
                            type: 'mapnik',
                            options: {
                                /* 10 points */
                                sql: 'SELECT row_number() over() as cartodb_id, ' +
                                    'ST_SetSRID(ST_MakePoint(3.609695,37.182749),4326) AS the_geom_webmercator ' +
                                    'FROM generate_series(1, 10) qseries',
                                geom_column: 'the_geom_webmercator',
                                cartocss: '#layer { marker-width: 1; marker-fill: #4dee83 }',
                                cartocss_version: '2.0.1',
                                interactivity: (renderer === 'Agg' ? undefined : 'cartodb_id')
                            }
                        }]
                    };

                    var testClient = new TestClient(mapconfig, { mapnik: { mapnik: { metrics: true } } });
                    testClient.getTile(0, 0, 0, { format: format }, function (err, tile, img, headers, stats) {
                        assert.ifError(err);
                        assert(Object.prototype.hasOwnProperty.call(stats, 'Mk_Agg_PMarkerS') || Object.prototype.hasOwnProperty.call(stats, 'Mk_Grid_PMarkerS'));
                        done();
                    });
                });

                it('Point symbolizer', function (done) {
                    var mapconfig = {
                        version: '1.2.0',
                        layers: [{
                            type: 'mapnik',
                            options: {
                                /* 10 points */
                                sql: 'SELECT row_number() over() as cartodb_id, ' +
                                    'ST_SetSRID(ST_MakePoint(3.609695,37.182749),4326) AS the_geom_webmercator ' +
                                    'FROM generate_series(1, 10) qseries',
                                geom_column: 'the_geom_webmercator',
                                cartocss: '#layer { point-file: url(' + this.markerFileUrl + '); point-opacity: 0.9}',
                                cartocss_version: '2.0.1',
                                interactivity: (renderer === 'Agg' ? undefined : 'cartodb_id')
                            }
                        }]
                    };

                    var testClient = new TestClient(mapconfig, { mapnik: { mapnik: { metrics: true } } });
                    testClient.getTile(0, 0, 0, { format: format }, function (err, tile, img, headers, stats) {
                        assert.ifError(err);
                        assert(Object.prototype.hasOwnProperty.call(stats, 'Mk_Agg_PPointS') || Object.prototype.hasOwnProperty.call(stats, 'Mk_Grid_PPointS'));
                        done();
                    });
                });

                it('Polygon pattern symbolizer', function (done) {
                    var mapconfig = {
                        version: '1.2.0',
                        layers: [{
                            type: 'mapnik',
                            options: {
                                /* 4 polygons */
                                sql: 'SELECT 51 as cartodb_id, ' +
                                        'ST_MakeEnvelope(-100,-40, 100, 40, 4326) as the_geom_webmercator' +
                                    ' UNION ALL ' +
                                    'SELECT 52 as cartodb_id, ' +
                                        'ST_MakeEnvelope(-100,-45, 100, 40, 4326) as the_geom_webmercator' +
                                    ' UNION ALL ' +
                                    'SELECT 53 as cartodb_id, ' +
                                        'ST_MakeEnvelope(-100,-45, 120, 40, 4326) as the_geom_webmercator' +
                                    ' UNION ALL ' +
                                    'SELECT 54 as cartodb_id, ' +
                                        'ST_MakeEnvelope(-100,-45, 100, 44, 4326) as the_geom_webmercator',
                                geom_column: 'the_geom_webmercator',
                                cartocss: '#layer { polygon-pattern-file: url(' + this.markerFileUrl + ') }',
                                cartocss_version: '2.0.1',
                                interactivity: (renderer === 'Agg' ? undefined : 'cartodb_id')
                            }
                        }]
                    };

                    var testClient = new TestClient(mapconfig, { mapnik: { mapnik: { metrics: true } } });
                    testClient.getTile(0, 0, 0, { format: format }, function (err, tile, img, headers, stats) {
                        assert.ifError(err);
                        assert(Object.prototype.hasOwnProperty.call(stats, 'Mk_Agg_PPolygonPatternS') ||
                               Object.prototype.hasOwnProperty.call(stats, 'Mk_Grid_PPolygonPatternS'));
                        done();
                    });
                });

                it('Polygon symbolizer', function (done) {
                    var mapconfig = {
                        version: '1.2.0',
                        layers: [{
                            type: 'mapnik',
                            options: {
                                /* 4 polygons */
                                sql: 'SELECT 51 as cartodb_id, ' +
                                        'ST_MakeEnvelope(-100,-40, 100, 40, 4326) as the_geom_webmercator' +
                                    ' UNION ALL ' +
                                    'SELECT 52 as cartodb_id, ' +
                                        'ST_MakeEnvelope(-100,-45, 100, 40, 4326) as the_geom_webmercator' +
                                    ' UNION ALL ' +
                                    'SELECT 53 as cartodb_id, ' +
                                        'ST_MakeEnvelope(-100,-45, 120, 40, 4326) as the_geom_webmercator' +
                                    ' UNION ALL ' +
                                    'SELECT 54 as cartodb_id, ' +
                                        'ST_MakeEnvelope(-100,-45, 100, 44, 4326) as the_geom_webmercator',
                                geom_column: 'the_geom_webmercator',
                                cartocss: "#layer { polygon-fill: 'blue'}",
                                cartocss_version: '2.0.1',
                                interactivity: (renderer === 'Agg' ? undefined : 'cartodb_id')
                            }
                        }]
                    };

                    var testClient = new TestClient(mapconfig, { mapnik: { mapnik: { metrics: true } } });
                    testClient.getTile(0, 0, 0, { format: format }, function (err, tile, img, headers, stats) {
                        assert.ifError(err);
                        assert(Object.prototype.hasOwnProperty.call(stats, 'Mk_Agg_PPolygonS') || Object.prototype.hasOwnProperty.call(stats, 'Mk_Grid_PPolygonS'));
                        done();
                    });
                });

                // Raster symbolizer isn't available for grid.json format
                if (renderer === 'Agg') {
                    it('Raster symbolizer', function (done) {
                        var mapconfig = {
                            version: '1.2.0',
                            layers: [{
                                type: 'mapnik',
                                options: {
                                    sql: 'select 1 as cartodb_id, ST_AsRaster(' +
                                        ' ST_MakeEnvelope(-100,-40, 100, 40, 4326), ' +
                                        " 1.0, -1.0, '8BUI', 127) as the_geom_webmercator",
                                    geom_column: 'the_geom_webmercator',
                                    geom_type: 'raster',
                                    cartocss: '#layer { raster-opacity:1.0 }',
                                    cartocss_version: '2.0.1'
                                }
                            }]
                        };

                        var testClient = new TestClient(mapconfig, { mapnik: { mapnik: { metrics: true } } });
                        testClient.getTile(0, 0, 0, { format: format }, function (err, tile, img, headers, stats) {
                            assert.ifError(err);
                            assert(Object.prototype.hasOwnProperty.call(stats, 'Mk_Agg_PRasterS'));
                            done();
                        });
                    });
                }

                it('Shield symbolizer', function (done) {
                    var mapconfig = {
                        version: '1.2.0',
                        layers: [{
                            type: 'mapnik',
                            options: {
                                /* 10 points */
                                sql: 'SELECT row_number() over() as cartodb_id, ' +
                                    'ST_SetSRID(ST_MakePoint(3.609695,37.182749),4326) AS the_geom_webmercator ' +
                                    'FROM generate_series(1, 10) qseries',
                                geom_column: 'the_geom_webmercator',
                                cartocss: '#layer { shield-file: url(' + this.markerFileUrl + '); ' +
                                          "         shield-face-name: 'DejaVu Sans Bold' }",
                                cartocss_version: '2.0.1',
                                interactivity: (renderer === 'Agg' ? undefined : 'cartodb_id')
                            }
                        }]
                    };

                    var testClient = new TestClient(mapconfig, { mapnik: { mapnik: { metrics: true } } });
                    testClient.getTile(0, 0, 0, { format: format }, function (err, tile, img, headers, stats) {
                        assert.ifError(err);
                        assert(Object.prototype.hasOwnProperty.call(stats, 'Mk_Agg_PShieldS') || Object.prototype.hasOwnProperty.call(stats, 'Mk_Grid_PShieldS'));
                        done();
                    });
                });

                it('Text symbolizer', function (done) {
                    var mapconfig = {
                        version: '1.2.0',
                        layers: [{
                            type: 'mapnik',
                            options: {
                                /* 10 points */
                                sql: 'SELECT row_number() over() as cartodb_id, ' +
                                    'ST_SetSRID(ST_MakePoint(3.609695,37.182749),4326) AS the_geom_webmercator ' +
                                    'FROM generate_series(1, 10) qseries',
                                geom_column: 'the_geom_webmercator',
                                cartocss: "#layer { text-opacity: 0.9; text-name: '[cartodb_id]'; " +
                                          "         text-face-name: 'DejaVu Sans Bold' }",
                                cartocss_version: '2.0.1',
                                interactivity: (renderer === 'Agg' ? undefined : 'cartodb_id')
                            }
                        }]
                    };

                    var testClient = new TestClient(mapconfig, { mapnik: { mapnik: { metrics: true } } });
                    testClient.getTile(0, 0, 0, { format: format }, function (err, tile, img, headers, stats) {
                        assert.ifError(err);
                        assert(Object.prototype.hasOwnProperty.call(stats, 'Mk_Agg_PTextS') || Object.prototype.hasOwnProperty.call(stats, 'Mk_Grid_PTextS'));
                        done();
                    });
                });
            });
        });
    });
});
