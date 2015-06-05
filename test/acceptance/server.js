require('../support/test_helper');

var assert = require('../support/assert');
var fs = require('fs');
var Windshaft = require('../../lib/windshaft');
var ServerOptions = require('../support/server_options');
var http = require('http');
var testClient = require('../support/test_client');

function rmdir_recursive_sync(dirname) {
  var files = fs.readdirSync(dirname);
  for (var i=0; i<files.length; ++i) {
    var f = dirname + "/" + files[i];
    var s = fs.lstatSync(f);
    if ( s.isFile() ) {
      fs.unlinkSync(f);
    } else {
        rmdir_recursive_sync(f);
    }
  }
}

describe('server', function() {

    var server = new Windshaft.Server(ServerOptions);
    server.setMaxListeners(0);
    var res_serv; // resources server
    var res_serv_status = { numrequests:0 }; // status of resources server
    var res_serv_port = 8033; // FIXME: make configurable ?

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


    ////////////////////////////////////////////////////////////////////
    //
    // GET INVALID
    //
    ////////////////////////////////////////////////////////////////////

    it("get call to server returns 200",  function(done){
        assert.response(server, {
            url: '/',
            method: 'GET'
        },{
            // FIXME: shouldn't this be a 404 ?
            status: 200
        }, function() { done(); } );
    });

    ////////////////////////////////////////////////////////////////////
    //
    // GET VERSION
    //
    ////////////////////////////////////////////////////////////////////

    it("get /version returns versions",  function(done){
        assert.response(server, {
            url: '/version',
            method: 'GET'
        },{
            status: 200
        }, function(res) {
          var parsed = JSON.parse(res.body);
          assert.ok(parsed.hasOwnProperty('windshaft'), "No 'windshaft' version in " + parsed);
          assert.ok(parsed.hasOwnProperty('grainstore'), "No 'grainstore' version in " + parsed);
          assert.ok(parsed.hasOwnProperty('node_mapnik'), "No 'node_mapnik' version in " + parsed);
          assert.ok(parsed.hasOwnProperty('mapnik'), "No 'mapnik' version in " + parsed);
          // TODO: check actual versions ?
          done();
        });
    });

    ////////////////////////////////////////////////////////////////////
    //
    // GET GRID
    //
    ////////////////////////////////////////////////////////////////////

    it("grid jsonp",  function(done){
        var mapConfig = testClient.singleLayerMapConfig('select * from test_table', null, null, 'name');
        testClient.getGridJsonp(mapConfig, 0, 13, 4011, 3088, 'test', function(err, res) {
            assert.equal(res.statusCode, 200, res.body);
            assert.deepEqual(res.headers['content-type'], 'application/json; charset=utf-8');
            var regexp = '^test\\((.*)\\);$';
            var matches = res.body.match(regexp);
            assert.equal(matches.length, 2, 'Unexpected JSONP response:'  + res.body);
            assert.utfgridEqualsFile(matches[1], './test/fixtures/test_table_13_4011_3088.grid.json', 2, done);
        });
    });

    it("get'ing a json with default style and single interactivity should return a grid",  function(done){
        var mapConfig = testClient.singleLayerMapConfig('select * from test_table', null, null, 'name');
        testClient.getGrid(mapConfig, 0, 13, 4011, 3088, function(err, res) {
            var expected_json = {
                "1":{"name":"Hawai"},
                "2":{"name":"El Estocolmo"},
                "3":{"name":"El Rey del Tallarín"},
                "4":{"name":"El Lacón"},
                "5":{"name":"El Pico"}
            };
            assert.deepEqual(JSON.parse(res.body).data, expected_json);
            done();
        });
    });

    it("get'ing a json with default style and no interactivity should return an error",  function(done){
        var mapConfig = testClient.singleLayerMapConfig('select * from test_table');
        var expectedResponse = {
            status: 400,
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            }
        };
        testClient.getGrid(mapConfig, 0, 13, 4011, 3088, expectedResponse, function(err, res) {
            console.log(res.body);
            done();
        });
    });

    it("get grid jsonp error is returned with 200 status",  function(done){
        var mapConfig = testClient.singleLayerMapConfig('select * from test_table');
        var expectedResponse = {
            status: 200,
            headers: {
                'Content-Type': 'text/javascript; charset=utf-8'
            }
        };
        testClient.getGridJsonp(mapConfig, 0, 13, 4011, 3088, 'test', expectedResponse, function(err, res) {
            assert.ok(res.body.match(/"errors":/), 'missing error in response: ' + res.body);
            done();
        });
    });

    // See http://github.com/Vizzuality/Windshaft/issues/50
    it("get'ing a json with no data should return an empty grid",  function(done){
        var query = 'select * from test_table limit 0';
        var mapConfig = testClient.singleLayerMapConfig(query, null, null, 'name');
        testClient.getGrid(mapConfig, 0, 13, 4011, 3088, function(err, res) {
            assert.utfgridEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_empty.grid.json', 2, done);
        });
    });

    // Another test for http://github.com/Vizzuality/Windshaft/issues/50
    it("get'ing a json with no data but interactivity should return an empty grid",  function(done){
        var query = 'SELECT * FROM test_table limit 0';
        var mapConfig = testClient.singleLayerMapConfig(query, null, null, 'cartodb_id');
        testClient.getGrid(mapConfig, 0, 13, 4011, 3088, function(err, res) {
            assert.utfgridEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_empty.grid.json', 2, done);
        });
    });

    // See https://github.com/Vizzuality/Windshaft-cartodb/issues/67
    it("get'ing a solid grid while changing interactivity fields",  function(done){
        var query = 'SELECT * FROM test_big_poly';
        var style211 = "#test_big_poly{polygon-fill:blue;}"; // for solid
        var mapConfigName = testClient.singleLayerMapConfig(query, style211, null, 'name');
        testClient.getGrid(mapConfigName, 0, 3, 2, 2, function(err, res) {
            var expected_data = { "1":{"name":"west"} };
            assert.deepEqual(JSON.parse(res.body).data, expected_data);

            var mapConfigCartodbId = testClient.singleLayerMapConfig(query, style211, null, 'cartodb_id');
            testClient.getGrid(mapConfigCartodbId, 0, 3, 2, 2, function(err, res) {
                var expected_data = { "1":{"cartodb_id":"1"} };
                assert.deepEqual(JSON.parse(res.body).data, expected_data);
                done();
            });
        });
    });

});
