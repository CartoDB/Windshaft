require('../support/test_helper');

var assert = require('../support/assert');
var querystring = require('querystring');
var fs = require('fs');
var redis = require('redis');
var step = require('step');
var Windshaft = require('../../lib/windshaft');
var ServerOptions = require('../support/server_options');
var http = require('http');

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

suite('external resources', function() {

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

    var IMAGE_EQUALS_TOLERANCE_PER_MIL = 25;

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

    test.skip("base and custom style tile referencing external resources do not affect each other",
        function(done){
      var style = "#test_table_3{marker-file: url('http://localhost:" + res_serv_port +
          "/circle.svg'); marker-transform:'scale(0.2)'; }";
      var style2 = "#test_table_3{marker-file: url('http://localhost:" + res_serv_port +
          "/square.svg'); marker-transform:'scale(0.2)'; }";
      var stylequery = querystring.stringify({style: style});
      step(
        function getCustomTile0() {
          var next = this;
          assert.response(server, {
            url: '/database/windshaft_test/table/test_table_3/13/4011/3088.png?' + stylequery,
            method: 'GET',
            encoding: 'binary'
          },{
              status: 200,
              headers: { 'Content-Type': 'image/png' }
          }, function(res){
              assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_svg1.png',
                  IMAGE_EQUALS_TOLERANCE_PER_MIL, function(err) {
                  next(err);
              });
          });
        },
        // Set another style as default for table
        function postStyle(err) {
          if ( err ) {
              throw err;
          }
          var next = this;
          //next(null, {statusCode: 200}); return;
          assert.response(server, {
              url: '/database/windshaft_test/table/test_table_3/style',
              method: 'POST',
              headers: {'Content-Type': 'application/x-www-form-urlencoded' },
              data: querystring.stringify({style: style2})
          }, {}, function(res) { next(null, res); });
        },
        // Check style setting succeeded
        function checkPost(err, res) {
          if ( err ) {
              throw err;
          }
          assert.equal(res.statusCode, 200, res.body);
          //assert.equal(res.body, "ok");
          return null;
        },
        // Now check we get the tile styled as we specified
        function getBaseTile0(err/*, data*/) {
          if ( err ) {
              throw err;
          }
          var next = this;
          assert.response(server, {
            url: '/database/windshaft_test/table/test_table_3/13/4011/3088.png',
            method: 'GET',
            encoding: 'binary'
          },{}, function(res){
              assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
              assert.equal(res.headers['content-type'], "image/png");
              assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_svg2.png',
                  IMAGE_EQUALS_TOLERANCE_PER_MIL, function(err) {
                  if (err) { next(err); return; }
                  next(null);
              });
          });
        },
        // Now fetch the custom style tile again
        function getCustomTile1(err) {
          if ( err ) {
              throw err;
          }
          var next = this;
          assert.response(server, {
            url: '/database/windshaft_test/table/test_table_3/13/4011/3088.png?cache_buster=2&' + stylequery,
            method: 'GET',
            encoding: 'binary'
          },{ }, function(res){
              assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
              assert.equal(res.headers['content-type'], "image/png");
              assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_svg1.png',
                  IMAGE_EQUALS_TOLERANCE_PER_MIL, function(err) {
                  next(err);
              });
          });
        },
        // Now fetch the base style tile again
        function getBaseTile1(err/*, data*/) {
          if ( err ) {
              throw err;
          }
          var next = this;
          assert.response(server, {
            url: '/database/windshaft_test/table/test_table_3/13/4011/3088.png?cache_buster=3',
            method: 'GET',
            encoding: 'binary'
          },{ }, function(res){
              assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
              assert.equal(res.headers['content-type'], "image/png");
              assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_svg2.png',
                  IMAGE_EQUALS_TOLERANCE_PER_MIL, function(err) {
                  if (err) { next(err); return; }
                  next(null);
              });
          });
        },
        function finish(err) {
          assert.response(server, {
              url: '/database/windshaft_test/table/test_table_3/style',
              method: 'DELETE' },{}, function() { done(err); });
        }
      );
    });

    // See http://github.com/CartoDB/Windshaft/issues/107
    test.skip("external resources get localized on renderer creation",
        function(done){
      var style = "#test_table_3{marker-file: url('http://localhost:" + res_serv_port +
          "/square.svg'); marker-transform:'scale(0.2)'; }";
      var stylequery = querystring.stringify({style: style});
      var numrequests;
      step(
        function getCustomTile0() {
          var next = this;
          assert.response(server, {
            url: '/database/windshaft_test/table/test_table_3/13/4011/3088.png?cache_buster=2.1&' + stylequery,
            method: 'GET',
            encoding: 'binary'
          },{
              status: 200,
              headers: { 'Content-Type': 'image/png' }
          }, function(res){
              numrequests = res_serv_status.numrequests;
              assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_svg2.png',
                  IMAGE_EQUALS_TOLERANCE_PER_MIL, function(err) {
                  next(err);
              });
          });
        },
        function dropLocalizedResources(err) {
          if ( err ) {
              throw err;
          }
          var cachedir = global.environment.millstone.cache_basedir;
          rmdir_recursive_sync(cachedir);
          // Reset server to ensure all renderer caches are flushed
          server = new Windshaft.Server(ServerOptions);
          server.setMaxListeners(0);
          return null;
        },
        // Now fetch the custom style tile again
        function getCustomTile1(err) {
          if ( err ) {
              throw err;
          }
          var next = this;
          assert.response(server, {
            url: '/database/windshaft_test/table/test_table_3/13/4011/3088.png?cache_buster=2.2&' + stylequery,
            method: 'GET',
            encoding: 'binary'
          },{}, function(res){
              assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
              assert.equal(res_serv_status.numrequests, numrequests+1);
              assert.equal(res.headers['content-type'], "image/png");
              assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_svg2.png',
                  IMAGE_EQUALS_TOLERANCE_PER_MIL, function(err) {
                  next(err);
              });
          });
        },
        // Now fetch the custom style tile again with an higher cache_buster,
        // checking that the external resource is NOT downloaded again
        function getCustomTile2(err) {
          if ( err ) {
              throw err;
          }
          var next = this;
          assert.response(server, {
            url: '/database/windshaft_test/table/test_table_3/13/4011/3088.png?cache_buster=2.3&' + stylequery,
            method: 'GET',
            encoding: 'binary'
          },{}, function(res){
              assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
              // millstone should not make another request
              assert.equal(res_serv_status.numrequests, numrequests+1);
              assert.equal(res.headers['content-type'], "image/png");
              assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_svg2.png',
                  IMAGE_EQUALS_TOLERANCE_PER_MIL, function(err) {
                  next(err);
              });
          });
        },
        function finish(err) {
          assert.response(server, {
              url: '/database/windshaft_test/table/test_table_3/style',
              method: 'DELETE' },{}, function() { done(err); });
        }
      );
    });

    test.skip("referencing unexistant external resources returns an error",
        function(done){
      var url = "http://localhost:" + res_serv_port + "/notfound.png";
      var style = "#test_table_3{marker-file: url('" + url + "'); marker-transform:'scale(0.2)'; }";
      var stylequery = querystring.stringify({style: style});
      assert.response(server, {
        url: '/database/windshaft_test/table/test_table_3/13/4011/3088.png?' + stylequery,
        method: 'GET',
        encoding: 'binary'
      },{}, function(res){
        assert.equal(res.statusCode, 400, res.body);
        assert.equal(res.headers['content-type'], "application/json; charset=utf-8");
        assert.deepEqual(JSON.parse(res.body), {
            "error":"Unable to download '" + url + "' for 'style.mss' (server returned 404)"
        });
        done();
      });
    });


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

