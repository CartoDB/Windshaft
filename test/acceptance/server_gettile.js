require('../support/test_helper');

var assert = require('../support/assert');
var fs = require('fs');
var mapnik = require('mapnik');
var Windshaft = require('../../lib/windshaft');
var ServerOptions = require('../support/server_options');
var semver = require('semver');
var http = require('http');
var TestClient = require('../support/test_client');

function rmdir_recursive_sync(dirname) {
  var files = fs.readdirSync(dirname);
  for (var i=0; i<files.length; ++i) {
    var f = dirname + "/" + files[i];
    var s = fs.lstatSync(f);
    if ( s.isFile() ) {
      fs.unlinkSync(f);
    }
    else {
        rmdir_recursive_sync(f);
    }
  }
}

describe('server_gettile', function() {

    var server = new Windshaft.Server(ServerOptions);
    server.setMaxListeners(0);
    var res_serv; // resources server
    var res_serv_status = { numrequests:0 }; // status of resources server
    var res_serv_port = 8033; // FIXME: make configurable ?

    var IMAGE_EQUALS_TOLERANCE_PER_MIL = 25;

    before(function(done) {
        // Start a server to test external resources
        res_serv = http.createServer( function(request, response) {
            ++res_serv_status.numrequests;
            var filename = __dirname + '/../fixtures/markers' + request.url;
            fs.readFile(filename, "binary", function(err, file) {
              if ( err ) {
                response.writeHead(404, {'Content-Type': 'text/plain'});
                response.write("404 Not Found\n");
              } else {
                response.writeHead(200);
                response.write(file, "binary");
              }
              response.end();
            });
        });
        res_serv.listen(res_serv_port, done);
    });


    after(function(done) {
        rmdir_recursive_sync(global.environment.millstone.cache_basedir);

        // Close the resources server
        res_serv.close(done);
    });

    function imageCompareFn(fixture, done) {
        return function(err, tile) {
            if (err) {
                return done(err);
            }
            assert.imageEqualsFile(tile, './test/fixtures/' + fixture, IMAGE_EQUALS_TOLERANCE_PER_MIL, done);
        };
    }


    ////////////////////////////////////////////////////////////////////
    //
    // GET TILE
    // --{
    ////////////////////////////////////////////////////////////////////

    it("get'ing a tile with default style should return an expected tile", function(done){
        new TestClient(TestClient.defaultTableMapConfig('test_table'))
            .getTile(13, 4011, 3088, imageCompareFn('test_table_13_4011_3088.png', done));
    });

    it("response of get tile can be served by renderer cache",  function(done) {
        var lastXwc;
        var testClient = new TestClient(TestClient.defaultTableMapConfig('test_table'));
        testClient.getTile(13, 4011, 3088, function(err, tile, img, headers) {
            var xwc = headers['X-Windshaft-Cache'];
            assert.ok(!xwc);

            testClient.getTile(13, 4011, 3088, function (err, tile, img, headers) {
                var xwc = headers['X-Windshaft-Cache'];
                assert.ok(xwc);
                assert.ok(xwc > 0);
                lastXwc = xwc;

                testClient.getTile(13, 4011, 3088, function (err, tile, img, headers) {
                    var xwc = headers['X-Windshaft-Cache'];
                    assert.ok(xwc);
                    assert.ok(xwc > 0);
                    assert.ok(xwc >= lastXwc);

                    testClient.getTile(13, 4011, 3088, {cache_buster: 'wadus'}, function (err, tile, img, headers) {
                        var xwc = headers['X-Windshaft-Cache'];
                        assert.ok(!xwc);

                        done();
                    });
                });
            });
        });
    });

    it("should not choke when queries end with a semicolon",  function(done){
        new TestClient(TestClient.singleLayerMapConfig('SELECT * FROM test_table limit 2;'))
            .getTile(0, 0, 0, done);
    });

    it("should not choke when sql ends with a semicolon and some blanks",  function(done){
        new TestClient(TestClient.singleLayerMapConfig('SELECT * FROM test_table limit 2; \t\n'))
            .getTile(0, 0, 0, done);
    });

    it("should not strip quoted semicolons within an sql query",  function(done){
        new TestClient(TestClient.singleLayerMapConfig("SELECT * FROM test_table where name != ';\n'"))
            .getTile(0, 0, 0, done);
    });

    it("getting two tiles with same configuration uses renderer cache",  function(done) {

        var imageFixture = './test/fixtures/test_table_13_4011_3088_styled.png';
        var mapConfig = TestClient.defaultTableMapConfig(
            'test_table',
            '#test_table{marker-fill: blue;marker-line-color: black;}'
        );

        var testClient = new TestClient(mapConfig);
        testClient.getTile(13, 4011, 3088, function(err, tile, img, headers) {
            assert.ok(!headers.hasOwnProperty('X-Windshaft-Cache'), "Did hit renderer cache on first time");

            testClient.getTile(13, 4011, 3088, function(err, tile, img, headers) {
                assert.ok(headers.hasOwnProperty('X-Windshaft-Cache'), "Did not hit renderer cache on second time");
                assert.ok(headers['X-Windshaft-Cache'] >= 0);

                assert.imageEqualsFile(tile, imageFixture, IMAGE_EQUALS_TOLERANCE_PER_MIL, done);
            });
        });
    });

    var test_style_black_200 = "#test_table{marker-fill:black;marker-line-color:black;marker-width:5}";
    var test_style_black_210 = "#test_table{marker-fill:black;marker-line-color:black;marker-width:10}";

    it("get'ing a tile with url specified 2.0.0 style should return an expected tile",  function(done){
        new TestClient(TestClient.defaultTableMapConfig('test_table', test_style_black_200, '2.0.0'))
            .getTile(13, 4011, 3088, imageCompareFn('test_table_13_4011_3088_styled_black.png', done));
    });

    it("get'ing a tile with url specified 2.1.0 style should return an expected tile",  function(done){
        new TestClient(TestClient.defaultTableMapConfig('test_table', test_style_black_210, '2.1.0'))
            .getTile(13, 4011, 3088, imageCompareFn('test_table_13_4011_3088_styled_black.png', done));
    });

    // See http://github.com/CartoDB/Windshaft/issues/99
    it("unused directives are tolerated",  function(done){
        var style = "#test_table{point-transform: 'scale(100)';}";
        var sql = "SELECT 1 as cartodb_id, 'SRID=4326;POINT(0 0)'::geometry as the_geom";
        new TestClient(TestClient.singleLayerMapConfig(sql, style))
            .getTile(0, 0, 0, imageCompareFn('test_default_mapnik_point.png', done));
    });

    // See http://github.com/CartoDB/Windshaft/issues/100
    var test_strictness = function(done) {
        var nonStrictMapConfig = TestClient.singleLayerMapConfig(
            "SELECT 1 as cartodb_id, 'SRID=3857;POINT(666 666)'::geometry as the_geom",
            "#test_table{point-transform: 'scale(100)';}"
        );
        var testClient = new TestClient(nonStrictMapConfig);
        testClient.getTile(0, 0, 0, {strict: 1}, function(err) {
            assert.ok(err);
            done();
        });
    };
    var test_strict_lbl = "unused directives are not tolerated if strict";
    if ( semver.satisfies(mapnik.versions.mapnik, '2.3.x') ) {
      // Strictness handling changed in 2.3.x, possibly a bug:
      // see http://github.com/mapnik/mapnik/issues/2301
      console.warn("Strictness test skipped due to http://github.com/mapnik/mapnik/issues/2301");
      it.skip(test_strict_lbl,  test_strictness);
    }
    else {
      it(test_strict_lbl,  test_strictness);
    }

    it('high cpu regression with mapnik <2.3.x', function(done) {
        var sql = [
            "SELECT 'my polygon name here' AS name,",
            "st_envelope(st_buffer(st_transform(",
            "st_setsrid(st_makepoint(-26.6592894004,49.7990296995),4326),3857),10000000)) AS the_geom",
            "FROM generate_series(-6,6) x",
            "UNION ALL",
            "SELECT 'my marker name here' AS name,",
            "       st_transform(st_setsrid(st_makepoint(49.6042060319,-49.0522997372),4326),3857) AS the_geom",
            "FROM generate_series(-6,6) x"
        ].join(' ');

        var style = [
            '#test_table {marker-fill:#ff7;',
            '    marker-max-error:0.447492761618;',
            '    marker-line-opacity:0.659371340628;',
            '    marker-allow-overlap:true;',
            '    polygon-fill:green;',
            '    marker-spacing:0.0;',
            '    marker-width:4.0;',
            '    marker-height:18.0;',
            '    marker-opacity:0.942312062822;',
            '    line-color:green;',
            '    line-gamma:0.945973211092;',
            '    line-cap:square;',
            '    polygon-opacity:0.12576055992;',
            '    marker-type:arrow;',
            '    polygon-gamma:0.46354913107;',
            '    line-dasharray:33,23;',
            '    line-join:bevel;',
            '    marker-placement:line;',
            '    line-width:1.0;',
            '    marker-line-color:#ff7;',
            '    line-opacity:0.39403752154;',
            '    marker-line-width:3.0;',
            '}'
        ].join('');

        new TestClient(TestClient.singleLayerMapConfig(sql, style))
            .getTile(13, 4011, 3088, done);
    });

    // https://github.com/CartoDB/Windshaft-cartodb/issues/316
    it('should return errors with better formatting', function(done) {
        var mapConfig = {
            "version": "1.0.1",
            "minzoom": 0,
            "maxzoom": 20,
            "layers": [
                {
                    "type": 'mapnik',
                    "options": {
                        "cartocss_version": '2.1.1',
                        "sql": "SELECT null::geometry AS the_geom",
                        "cartocss": [
                            '@water: #cdd2d4;',
                            'Map {',
                            '\tbackground-color: @water;',
                            '\tbufferz-size: 256;',
                            '}',
                            '@landmass_fill: lighten(#e3e3dc, 8%);'
                        ].join('\n')
                    }
                },
                {
                    "type": 'mapnik',
                    "options": {
                        "cartocss_version": '2.1.1',
                        "sql": "SELECT the_geom FROM false_background_zoomed('!scale_denominator!', !bbox!) AS _",
                        "cartocss": [
                            '#false_background {',
                            '\tpolygon-fill: @landmass_fill;',
                            '}'
                        ].join('\n')
                    }
                }
            ]
        };

        new TestClient(mapConfig).createLayergroup(function(err) {
            assert.ok(err);
            // more assertions when errors is populated with better format
            done();
        });
    });

});
