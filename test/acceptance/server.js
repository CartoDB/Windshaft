// FLUSHALL Redis before starting
require('../support/test_helper');

var assert        = require('../support/assert');
var querystring   = require('querystring');
var fs            = require('fs');
var redis         = require('redis');
var Windshaft     = require('../../lib/windshaft');
var ServerOptions = require('../support/server_options');
var http          = require('http');

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

suite('server', function() {

    ////////////////////////////////////////////////////////////////////
    //
    // SETUP
    //
    ////////////////////////////////////////////////////////////////////

    var server = new Windshaft.Server(ServerOptions);
    server.setMaxListeners(0);
    var redis_client = redis.createClient(ServerOptions.redis.port);
    var res_serv; // resources server
    var res_serv_status = { numrequests:0 }; // status of resources server
    var res_serv_port = 8033; // FIXME: make configurable ?

    suiteSetup(function(done) {

      // Check that we start with an empty redis db 
      redis_client.keys("*", function(err, matches) {

        if ( err ) { done(err); return; }

        assert.equal(matches.length, 0,
          "redis keys present at setup time on port " +
          ServerOptions.redis.port + ":\n" + matches.join("\n"));

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

    });


    ////////////////////////////////////////////////////////////////////
    //
    // GET INVALID
    //
    ////////////////////////////////////////////////////////////////////

    test("get call to server returns 200",  function(done){
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

    test("get /version returns versions",  function(done){
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

    test.skip("grid jsonp",  function(done){
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/13/4011/3088.grid.json?interactivity=name&callback=test',
            method: 'GET'
        },{}, function(res){
            assert.equal(res.statusCode, 200, res.body);
            assert.deepEqual(res.headers['content-type'], 'application/json; charset=utf-8');
            var regexp = '^test\\((.*)\\);$';
            var matches = res.body.match(regexp);
            assert.equal(matches.length, 2, 'Unexpected JSONP response:'  + res.body);
            assert.utfgridEqualsFile(matches[1], './test/fixtures/test_table_13_4011_3088.grid.json', 2, done);
        });
    });

    test.skip("get'ing a json with default style and single interactivity should return a grid",  function(done){
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/13/4011/3088.grid.json?interactivity=name',
            method: 'GET'
        },{
            status: 200,
            headers: { 'Content-Type': 'application/json; charset=utf-8' }
        }, function(res){
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

    test.skip("get'ing a json with default style and no interactivity should return an error",  function(done){
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/13/4011/3088.grid.json',
            method: 'GET'
        },{
        }, function(res){
            assert.equal(res.statusCode, 400);
            assert.deepEqual(JSON.parse(res.body), {error: 'Missing interactivity parameter'});
            done();
        });
    });

    test.skip("get grid jsonp error is returned with 200 status",  function(done){
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/13/4011/3088.grid.json?callback=test',
            method: 'GET'
        },{}, function(res){
            assert.equal(res.statusCode, 200);
            assert.ok(res.body.match(/"error":/), 'missing error in response: ' + res.body);
            done();
        });
    });

    // See http://github.com/Vizzuality/Windshaft/issues/50
    test.skip("get'ing a json with no data should return an empty grid",  function(done){
        var sql = querystring.stringify({sql: "SELECT * FROM test_table limit 0"});
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/13/4011/3088.grid.json?interactivity=name&' + sql,
            method: 'GET'
        },{
            status: 200,
            headers: { 'Content-Type': 'application/json; charset=utf-8' }
        }, function(res){
            assert.utfgridEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_empty.grid.json', 2, done);
        });
    });

    // Another test for http://github.com/Vizzuality/Windshaft/issues/50
    // this time with interactivity and cache_buster
    test.skip("get'ing a json with no data but interactivity should return an empty grid",  function(done){
        var sql = querystring.stringify({
          sql: "SELECT * FROM test_table limit 0",
          interactivity: 'cartodb_id',
          cache_buster: 4});
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/13/4011/3088.grid.json?' + sql,
            method: 'GET'
        },{
            status: 200,
            headers: { 'Content-Type': 'application/json; charset=utf-8' }
        }, function(res){
            assert.utfgridEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_empty.grid.json', 2, done);
        });
    });

    // See https://github.com/Vizzuality/Windshaft-cartodb/issues/67
    test.skip("get'ing a solid grid while changing interactivity fields",  function(done){
        var baseurl = '/database/windshaft_test/table/test_big_poly/3/2/2.grid.json?';
        var style211 = "#test_big_poly{polygon-fill:blue;}"; // for solid
        baseurl += querystring.stringify({
          style: style211,
          style_version: '2.1.0'}
        );
        baseurl += '&';
        assert.response(server, {
            url: baseurl + 'interactivity=name',
            method: 'GET'
        },{}, function(res){
            assert.equal(res.statusCode, 200, res.body);
            var expected_data = { "1":{"name":"west"} };
            assert.deepEqual(JSON.parse(res.body).data, expected_data);
            assert.response(server, {
                url: baseurl + 'interactivity=cartodb_id',
                method: 'GET'
            },{}, function(res){
                assert.equal(res.statusCode, 200, res.body);
                var expected_data = { "1":{"cartodb_id":"1"} };
                assert.deepEqual(JSON.parse(res.body).data, expected_data);
                done();
            });
        });
    });

    ////////////////////////////////////////////////////////////////////
    //
    // TEARDOWN
    //
    ////////////////////////////////////////////////////////////////////

    suiteTeardown(function(done) {

      // Close the resources server
      res_serv.close();

      var errors = [];

      // Check that we left the redis db empty
      redis_client.keys("*", function(err, matches) {
          if ( err ) {
              errors.push(err);
          }
          try { 
            assert.equal(matches.length, 0, "Left over redis keys:\n" + matches.join("\n"));
          } catch (err) {
            errors.push(err);
          }

          var cachedir = global.environment.millstone.cache_basedir;
          rmdir_recursive_sync(cachedir);
              
          redis_client.flushall(function() {
            done(errors.length ? new Error(errors) : null);
          });
      });

    });
});

