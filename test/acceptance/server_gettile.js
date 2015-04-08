require('../support/test_helper');

var assert = require('../support/assert');
var fs = require('fs');
var mapnik = require('mapnik');
var Windshaft = require('../../lib/windshaft');
var ServerOptions = require('../support/server_options');
var semver = require('semver');
var http = require('http');
var testClient = require('../support/test_client');

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
        return function(err, res) {
            if (err) {
                return done(err);
            }
            assert.imageEqualsFile(res.body, './test/fixtures/' + fixture, IMAGE_EQUALS_TOLERANCE_PER_MIL, done);
        };
    }


    ////////////////////////////////////////////////////////////////////
    //
    // GET TILE
    // --{
    ////////////////////////////////////////////////////////////////////

    it("get'ing a tile with default style should return an expected tile", function(done){
      testClient.getTile(testClient.defaultTableMapConfig('test_table'), 13, 4011, 3088,
          imageCompareFn('test_table_13_4011_3088.png', done)
      );
    });

    it("response of get tile can be served by renderer cache",  function(done) {
        var tileUrl = '/13/4011/3088.png';
        var lastXwc;
        var mapConfig = testClient.defaultTableMapConfig('test_table');
        testClient.withLayergroup(mapConfig, function (err, requestTile, finish) {
            requestTile(tileUrl, function (err, res) {
                var xwc = res.headers['x-windshaft-cache'];
                assert.ok(xwc);
                assert.ok(xwc > 0);
                lastXwc = xwc;

                requestTile(tileUrl, function (err, res) {
                    var xwc = res.headers['x-windshaft-cache'];
                    assert.ok(xwc);
                    assert.ok(xwc > 0);
                    assert.ok(xwc >= lastXwc);

                    requestTile(tileUrl + '?cache_buster=wadus', function (err, res) {
                        var xwc = res.headers['x-windshaft-cache'];
                        assert.ok(!xwc);

                        finish(done);
                    });
                });
            });
        });
    });

    it("should not choke when queries end with a semicolon",  function(done){
        testClient.getTile(testClient.singleLayerMapConfig('SELECT * FROM test_table limit 2;'), 0, 0, 0, done);
    });

    it("should not choke when sql ends with a semicolon and some blanks",  function(done){
        testClient.getTile(testClient.singleLayerMapConfig('SELECT * FROM test_table limit 2; \t\n'), 0, 0, 0, done);
    });

    it("should not strip quoted semicolons within an sql query",  function(done){
        testClient.getTile(
            testClient.singleLayerMapConfig("SELECT * FROM test_table where name != ';\n'"), 0, 0, 0, done
        );
    });

    it("getting two tiles with same configuration uses renderer cache",  function(done) {

        var imageFixture = './test/fixtures/test_table_13_4011_3088_styled.png';
        var tileUrl = '/13/4011/3088.png';
        var mapConfig = testClient.defaultTableMapConfig(
            'test_table',
            '#test_table{marker-fill: blue;marker-line-color: black;}'
        );

        function validateLayergroup(res) {
            // cache is hit because we create a renderer to validate the map config
            assert.ok(!res.headers.hasOwnProperty('x-windshaft-cache'), "Did hit renderer cache on first time");
        }

        testClient.withLayergroup(mapConfig, validateLayergroup, function(err, requestTile, finish) {

            requestTile(tileUrl, function(err, res) {
                assert.ok(res.headers.hasOwnProperty('x-windshaft-cache'), "Did not hit renderer cache on second time");
                assert.ok(res.headers['x-windshaft-cache'] >= 0);

                assert.imageEqualsFile(res.body, imageFixture, IMAGE_EQUALS_TOLERANCE_PER_MIL, function(err) {

                    finish(function(finishErr) {
                        done(err || finishErr);
                    });
                });
            });
        });
    });

    var test_style_black_200 = "#test_table{marker-fill:black;marker-line-color:black;marker-width:5}";
    var test_style_black_210 = "#test_table{marker-fill:black;marker-line-color:black;marker-width:10}";

    it("get'ing a tile with url specified 2.0.0 style should return an expected tile",  function(done){
        testClient.getTile(testClient.defaultTableMapConfig('test_table', test_style_black_200, '2.0.0'),
            13, 4011, 3088, imageCompareFn('test_table_13_4011_3088_styled_black.png', done));
    });

    it("get'ing a tile with url specified 2.1.0 style should return an expected tile",  function(done){
        testClient.getTile(testClient.defaultTableMapConfig('test_table', test_style_black_210, '2.1.0'),
            13, 4011, 3088, imageCompareFn('test_table_13_4011_3088_styled_black.png', done));
    });

    // See http://github.com/CartoDB/Windshaft/issues/99
    it("unused directives are tolerated",  function(done){
        var style = "#test_table{point-transform: 'scale(100)';}";
        var sql = "SELECT 1 as cartodb_id, 'SRID=4326;POINT(0 0)'::geometry as the_geom";
        testClient.getTile(testClient.singleLayerMapConfig(sql, style), 0, 0, 0,
            imageCompareFn('test_default_mapnik_point.png', done));
    });

    // See http://github.com/CartoDB/Windshaft/issues/100
    var test_strictness = function(done) {
        var nonStrictMapConfig = testClient.singleLayerMapConfig(
            "SELECT 1 as cartodb_id, 'SRID=3857;POINT(666 666)'::geometry as the_geom",
            "#test_table{point-transform: 'scale(100)';}"
        );
        testClient.withLayergroup(nonStrictMapConfig, function(err, requestTile, finish) {
            var options = {
                statusCode: 400,
                contentType: 'application/json; charset=utf-8'
            };
            requestTile('/0/0/0.png?strict=1', options, function() {
                finish(done);
            });
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

    it("beforeTileRender is called when the client request a tile",  function(done) {
        testClient.getTile(testClient.defaultTableMapConfig('test_table'), 6, 31, 24, function(err, res) {
            assert.equal(res.headers['x-beforetilerender'], 'called');
            done();
        });
    });

    it("afterTileRender is called when the client request a tile",  function(done) {
        testClient.getTile(testClient.defaultTableMapConfig('test_table'), 6, 31, 24, function(err, res) {
            assert.equal(res.headers['x-aftertilerender'], 'called');
            assert.equal(res.headers['x-aftertilerender2'], 'called');
            done();
        });
    });

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

        testClient.getTile(testClient.singleLayerMapConfig(sql, style), 13, 4011, 3088, done);
    });

});
