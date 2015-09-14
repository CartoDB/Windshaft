require('../support/test_helper');

var assert = require('../support/assert');
var _ = require('underscore');
var querystring = require('querystring');
var fs = require('fs');
var redis = require('redis');
var step = require('step');
var mapnik = require('mapnik');
var Windshaft = require('../../lib/windshaft');
var ServerOptions = require('../support/server_options');
var http = require('http');

var TestClient = require('../support/test_client');

describe('multilayer', function() {

    var server = new Windshaft.Server(ServerOptions);
    server.setMaxListeners(0);
    var redis_client = redis.createClient(ServerOptions.redis.port);
    var resourcesServer;
    var resourcesServerPort = 8033;
    var available_system_fonts = _.keys(mapnik.fontFiles());

    var IMAGE_EQUALS_TOLERANCE_PER_MIL = 20;

    function checkCORSHeaders(res) {
      assert.equal(res.headers['access-control-allow-headers'], 'X-Requested-With, X-Prototype-Version, X-CSRF-Token');
      assert.equal(res.headers['access-control-allow-origin'], '*');
    }

    before(function(done) {
      // Start a server to test external resources
      resourcesServer = http.createServer( function(request, response) {
          var filename = __dirname + '/../fixtures/markers' + request.url;
          fs.readFile(filename, "binary", function(err, file) {
            if ( err ) {
              response.writeHead(404, {'Content-Type': 'text/plain'});
              console.log("File '" + filename + "' not found");
              response.write("404 Not Found\n");
            } else {
              response.writeHead(200);
              response.write(file, "binary");
            }
            response.end();
          });
      });
      resourcesServer.listen(resourcesServerPort, done);
    });

    after(function(done) {
        // Close the resources server
        resourcesServer.close(done);
    });

    // See https://github.com/Vizzuality/Windshaft/issues/71
    it("single layer with multiple css sections", function(done) {
      var layergroup =  {
        version: '1.0.1',
        layers: [
           { options: {
               sql: 'select st_setsrid(st_makepoint(0, 0), 4326) as the_geom',
               cartocss: '#layer { marker-fill:red; } #layer { marker-width:100; }',
               cartocss_version: '2.0.1'
             } }
        ]
      };

        var testClient = new TestClient(layergroup);
        testClient.getTile(0, 0, 0, function(err, tile) {
            assert.imageEqualsFile(tile, './test/fixtures/test_bigpoint_red.png', IMAGE_EQUALS_TOLERANCE_PER_MIL, done);
        });
    });

      var layergroup =  {
        version: '1.0.1',
        layers: [
           { options: {
               sql: 'select cartodb_id, ST_Translate(the_geom, 50, 0) as the_geom from test_table limit 2',
               cartocss: '#layer { marker-fill:red; marker-width:32; marker-allow-overlap:true; }',
               cartocss_version: '2.0.1',
               interactivity: [ 'cartodb_id' ]
             } },
           { options: {
               sql: 'select cartodb_id, ST_Translate(the_geom, -50, 0) as the_geom from test_table limit 2 offset 2',
               cartocss: '#layer { marker-fill:blue; marker-allow-overlap:true; }',
               cartocss_version: '2.0.2',
               interactivity: [ 'cartodb_id' ]
             } }
        ]
      };

    it("layergroup with 2 layers, each with its style (png)", function(done) {
        var testClient = new TestClient(layergroup);
        testClient.getTile(0, 0, 0, function (err, tile) {
            assert.imageEqualsFile(tile, './test/fixtures/test_table_0_0_0_multilayer1.png',
                IMAGE_EQUALS_TOLERANCE_PER_MIL, done);
        });
    });

    it("layergroup with 2 layers, each with its style (grid.json, layer 0)", function(done) {
        var testClient = new TestClient(layergroup);
        testClient.getTile(0, 0, 0, {layer: 0, format: 'grid.json'}, function (err, tile) {
            assert.utfgridEqualsFile(tile, './test/fixtures/test_table_0_0_0_multilayer1.layer0.grid.json', 2, done);
        });
    });

    it("layergroup with 2 layers, each with its style (grid.json, layer 1)", function(done) {
        var testClient = new TestClient(layergroup);
        testClient.getTile(0, 0, 0, {layer: 1, format: 'grid.json'}, function (err, tile) {
            assert.utfgridEqualsFile(tile, './test/fixtures/test_table_0_0_0_multilayer1.layer1.grid.json', 2, done);
        });
    });

    it("layergroup with 2 layers, create layergroup", function(done) {
        var testClient = new TestClient(layergroup);
        testClient.createLayergroup(function(err, layergroup) {
            assert.ok(!err);
            assert.ok(layergroup);
            assert.ok(layergroup.layergroupid);
            assert.equal(layergroup.metadata.layers.length, 2);
            done();
        });
    });

      var layergroupWith3Layers = {
        version: '1.1.0',
        layers: [
           { options: {
               sql: 'select cartodb_id, ST_Translate(the_geom, 50, 0) as the_geom from test_table limit 2',
               cartocss: '#layer { marker-fill:red; marker-width:32; marker-allow-overlap:true; }',
               cartocss_version: '2.0.1',
               interactivity: [ 'cartodb_id' ]
             } },
           { options: {
               sql: 'select cartodb_id, cartodb_id*10 as n, ST_Translate(the_geom, -50, 0) as the_geom' +
                   ' from test_table ORDER BY cartodb_id limit 2 offset 2',
               cartocss: '#layer { marker-fill:blue; marker-allow-overlap:true; }',
               cartocss_version: '2.0.2',
               interactivity: [ 'cartodb_id' ],
               attributes: { id: 'cartodb_id', columns: ['n'] }
             } },
           { type: 'torque', options: {
               sql: "select cartodb_id, '1970-01-01'::date as d," +
                   " ST_SnapToGrid(the_geom_webmercator,1e10) as the_geom_webmercator " +
                   "from test_table WHERE cartodb_id = 4",
               cartocss: 'Map { -torque-frame-count:1; -torque-resolution:1; -torque-time-attribute:d; ' +
                   '-torque-aggregation-function:"count(*)"; } #layer { marker-fill:blue; marker-allow-overlap:true; }'
             } }
        ]
      };

    it("layergroup with 3 mixed layers, mapnik png torque and attributes", function(done) {
        var testClient = new TestClient(layergroupWith3Layers);
        testClient.getTile(0, 0, 0, function (err, tile) {
            assert.ok(!err);
            assert.imageEqualsFile(tile, './test/fixtures/test_table_0_0_0_multilayer1.png',
                IMAGE_EQUALS_TOLERANCE_PER_MIL, done);
        });
    });

    it("layergroup with 3 mixed layers, mapnik grid.json (layer 0)", function(done) {
        var testClient = new TestClient(layergroupWith3Layers);
        testClient.getTile(0, 0, 0, {layer: 0, format: 'grid.json'}, function (err, tile) {
            assert.ok(!err);
            assert.utfgridEqualsFile(tile, './test/fixtures/test_table_0_0_0_multilayer1.layer0.grid.json', 2, done);
        });
    });

    it("layergroup with 3 mixed layers, mapnik grid.json (layer 1)", function(done) {
        var testClient = new TestClient(layergroupWith3Layers);
        testClient.getTile(0, 0, 0, {layer: 1, format: 'grid.json'}, function (err, tile) {
            assert.ok(!err);
            assert.utfgridEqualsFile(tile, './test/fixtures/test_table_0_0_0_multilayer1.layer1.grid.json', 2, done);
        });
    });

    it("layergroup with 3 mixed layers, attributes (layer 1)", function(done) {
        var testClient = new TestClient(layergroupWith3Layers);
        testClient.getFeatureAttributes(1, 4, function (err, attributes) {
            assert.ok(!err);
            assert.deepEqual(attributes, { n: 40 });
            done();
        });
    });

    it("layergroup with 3 mixed layers, torque.json (layer 2)", function(done) {
        var testClient = new TestClient(layergroupWith3Layers);
        testClient.getTile(0, 0, 0, {layer: 2, format: 'torque.json'}, function (err, torqueTile) {
            assert.ok(!err);
            assert.deepEqual(torqueTile[0].vals__uint8, [1]);
            assert.deepEqual(torqueTile[0].dates__uint16, [0]);
            assert.equal(torqueTile[0].x__uint8, 128);
            assert.equal(torqueTile[0].y__uint8, 128);
            done();
        });
    });

    it("layergroup with 3 mixed layers, torque.json error on layer 1", function(done) {
        var testClient = new TestClient(layergroupWith3Layers);
        testClient.getTile(0, 0, 0, {layer: 1, format: 'torque.json'}, function (err) {
            assert.ok(err);
            assert.equal(err.message, 'Unsupported format torque.json');
            done();
        });
    });

    it("check that distinct maps result in distinct tiles", function(done) {

      var layergroup1 =  {
        version: '1.0.0',
        layers: [
           { options: {
               sql: 'select cartodb_id, ST_Translate(the_geom, 50, 0) as the_geom from test_table limit 2',
               cartocss: '#layer { marker-fill:red; marker-width:32; marker-allow-overlap:true; }',
               cartocss_version: '2.0.1',
               interactivity: 'cartodb_id'
             } }
        ]
      };

      var layergroup2 =  {
        version: '1.0.0',
        layers: [
           { options: {
               sql: 'select cartodb_id, ST_Translate(the_geom, -50, 0) as the_geom from test_table limit 2 offset 2',
               cartocss: '#layer { marker-fill:blue; marker-allow-overlap:true; }',
               cartocss_version: '2.0.2',
               interactivity: 'cartodb_id'
             } }
        ]
      };

        var testClient1 = new TestClient(layergroup1);
        var testClient2 = new TestClient(layergroup2);

        step(
            function getTile1() {
                var next = this;
                testClient1.getTile(0, 0, 0, function(err, tile) {
                    assert.ok(!err);
                    assert.imageEqualsFile(tile, './test/fixtures/test_table_0_0_0_multilayer2.png',
                        IMAGE_EQUALS_TOLERANCE_PER_MIL, next);
                });
            },
            function getGrid1(err) {
                assert.ifError(err);

                var next = this;
                testClient1.getTile(0, 0, 0, {layer: 0, format: 'grid.json'}, function (err, tile) {
                    assert.ok(!err);
                    assert.utfgridEqualsFile(tile, './test/fixtures/test_table_0_0_0_multilayer1.layer0.grid.json', 2,
                        next);
                });
            },
            function getTile2(err) {
                assert.ifError(err);

                var next = this;
                testClient2.getTile(0, 0, 0, function (err, tile) {
                    assert.ok(!err);
                    assert.imageEqualsFile(tile, './test/fixtures/test_table_0_0_0_multilayer3.png',
                        IMAGE_EQUALS_TOLERANCE_PER_MIL, next);
                });
            },
            function getGrid2(err) {
                assert.ifError(err);

                var next = this;
                testClient2.getTile(0, 0, 0, {layer: 0, format: 'grid.json'}, function (err, tile) {
                    assert.ok(!err);
                    assert.utfgridEqualsFile(tile, './test/fixtures/test_table_0_0_0_multilayer1.layer1.grid.json', 2,
                        next);
                });
            },
            function finish(err) {
                done(err);
            }
        );
    });

    var layergroupOrder =  {
        version: '1.0.1',
        layers: [
           { options: {
               sql: "select st_setsrid('LINESTRING(-60 -60,-60 60)'::geometry, 4326) as the_geom",
               cartocss_version: '2.0.2',
               cartocss: '#layer { line-width:16; line-color:#ff0000; }'
             } },
           { options: {
               sql: "select st_setsrid('LINESTRING(-100 0,100 0)'::geometry, 4326) as the_geom",
               cartocss_version: '2.0.2',
               cartocss: '#layer { line-width:16; line-color:#00ff00; }'
             } },
           { options: {
               sql: "select st_setsrid('LINESTRING(60 -60,60 60)'::geometry, 4326) as the_geom",
               cartocss_version: '2.0.2',
               cartocss: '#layer { line-width:16; line-color:#0000ff; }'
             } }
        ]
      };

    it("layers are rendered in definition order (create)", function(done) {
        var testClient = new TestClient(layergroupOrder);
        testClient.createLayergroup(function (err, layergroup) {
            assert.ok(!err);
            assert.ok(layergroup);
            assert.ok(layergroup.layergroupid);
            assert.equal(layergroup.metadata.layers.length, 3);
            done();
        });
    });

    it("layers are rendered in definition order (png)", function(done) {
        var testClient = new TestClient(layergroupOrder);
        testClient.getTile(0, 0, 0, function (err, tile) {
            assert.ok(!err);
            assert.imageEqualsFile(tile, './test/fixtures/test_table_0_0_0_multilayer4.png',
                IMAGE_EQUALS_TOLERANCE_PER_MIL, done);
        });
    });

    it("quotes in CartoCSS", function(done) {

      var layergroup =  {
        version: '1.0.1',
        layers: [
           { options: {
               sql: "select 'single''quote' as n, 'SRID=4326;POINT(0 0)'::geometry as the_geom",
               cartocss: '#s [n="single\'quote" ] { marker-fill:red; }',
               cartocss_version: '2.1.0'
             } },
           { options: {
               sql: "select 'double\"quote' as n, 'SRID=4326;POINT(2 0)'::geometry as the_geom",
               cartocss: '#s [n="double\\"quote" ] { marker-fill:red; }',
               cartocss_version: '2.1.0'
             } }
        ]
      };
        new TestClient(layergroup).createLayergroup(function(err, layergroup) {
            assert.ok(!err);
            assert.ok(layergroup);
            assert.ok(layergroup.layergroupid);
            assert.equal(layergroup.metadata.layers.length, 2);
            done();
        });
    });

    // See https://github.com/CartoDB/Windshaft/issues/90
    it("exponential notation in CartoCSS filter", function(done) {

      var layergroup =  {
        version: '1.0.1',
        layers: [
           { options: {
               sql: "select 1.0 as n, 'SRID=4326;POINT(0 0)'::geometry as the_geom",
               cartocss: '#s [n=1e-4 ] { marker-fill:red; }',
               cartocss_version: '2.1.0'
             } }
        ]
      };
        new TestClient(layergroup).createLayergroup(function(err, layergroup) {
            assert.ok(!err);
            assert.ok(layergroup);
            assert.ok(layergroup.layergroupid);
            assert.equal(layergroup.metadata.layers.length, 1);
            done();
        });
    });

    function fontLayergroup(fontName) {
        return {
            version: '1.0.1',
            layers: [
                { options: {
                    sql: "select 1.0 as n, 'SRID=4326;POINT(0 0)'::geometry as the_geom",
                    cartocss: '#s { text-name: [n]; text-face-name: "' + fontName + '"; }',
                    cartocss_version: '2.1.0'
                } }
            ]
        };
    }

    // See https://github.com/CartoDB/Windshaft/issues/94
    it("unknown text-face-name", function(done) {
        new TestClient(fontLayergroup('bogus')).getTile(0, 0, 0, function (err) {
            assert.ok(err);
            assert.equal(err.message, "Unable to find specified font face 'bogus'");
            done();
        });
    });

    it("known text-face-name", function(done) {
        new TestClient(fontLayergroup(available_system_fonts[0])).getTile(0, 0, 0, function (err, tile) {
            assert.ok(!err);
            assert.ok(tile);
            done();
        });
    });

    // See:
    //  - https://github.com/CartoDB/Windshaft/issues/103
    //  - https://github.com/mapnik/mapnik/issues/2121
    //  - https://github.com/mapnik/mapnik/issues/764
    it.skip("layergroup with datetime interactivity", function(done) {

      var layergroup =  {
        version: '1.0.1',
        layers: [
           { options: {
               sql: 'select 1 as i, 2::int2 as n, now() as t, ST_SetSRID(ST_MakePoint(0,0),3857) as the_geom',
               cartocss: '#layer { marker-fill:red; }',
               cartocss_version: '2.1.1',
               interactivity: [ 'i', 't', 'n' ]
             } }
        ]
      };

        var testClient = new TestClient(layergroup);
        testClient.getTile(0, 0, 0, {layer: 0, format: 'grid.json'}, function (err, grid) {
            assert.ok(!err);
            assert.ok(grid);

            assert.ok(grid.hasOwnProperty('data'));
            assert.ok(grid.data.hasOwnProperty('1'));
            var data = grid.data[1];
            assert.ok(data.hasOwnProperty('n'), "Missing 'n' from grid data keys: " + _.keys(data));
            assert.ok(data.hasOwnProperty('i'), "Missing 'i' from grid data keys: " + _.keys(data));
            assert.ok(data.hasOwnProperty('t'), "Missing 't' from grid data keys: " + _.keys(data));

            // this should not be undefined, skipping test until this can be fixed
            // the workaround is to cast now() as now()::text
            assert.ok(data.t, data.t);

            done();
        });
    });

    // See https://github.com/CartoDB/Windshaft/issues/163
    it("has different token for different database", function(done) {
      var layergroup =  {
        version: '1.0.1',
        layers: [
           { options: {
               sql: 'select 1 as i, 2::int2 as n, now() as t, ST_SetSRID(ST_MakePoint(0,0),3857) as the_geom',
               cartocss: '#layer { marker-fill:red; marker-width:32; marker-allow-overlap:true; }',
               cartocss_version: '2.0.1'
             } }
        ]
      };
      var token1;

        var testClient = new TestClient(layergroup);

        step(
            function requestLayergroup1() {
                testClient.createLayergroup(this);
            },
            function requestLayergroup2(err, layergroup) {
                assert.ifError(err);

                token1 = layergroup.layergroupid;

                testClient.createLayergroup({dbname: 'windshaft_test2'}, this);
            },
            function handleLayergroup2(err, layergroup) {
                assert.ifError(err);

                assert.notEqual(token1, layergroup.layergroupid);

                return null;
            },
            done
        );
    });

    // See http://github.com/CartoDB/Windshaft/issues/191
    it("mapnik layer with custom geom_column", function(done) {
      var layergroup =  {
        version: '1.0.1',
        layers: [
           { options: {
               sql: 'select 1 as i, ST_SetSRID(ST_MakePoint(0,0),4326) as g',
               cartocss: '#layer { marker-fill:red; marker-width:100; }',
               cartocss_version: '2.0.1',
               geom_column: 'g'
             } }
        ]
      };
        var testClient = new TestClient(layergroup);
        testClient.getTile(0, 0, 0, function(err, tile) {
            assert.imageEqualsFile(tile, './test/fixtures/test_bigpoint_red.png', IMAGE_EQUALS_TOLERANCE_PER_MIL, done);
        });
    });

});

