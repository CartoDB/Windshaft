require('../support/test_helper');

var assert = require('../support/assert');
var fs = require('fs');
var redis = require('redis');
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
    }
    else {
        rmdir_recursive_sync(f);
    }
  }
}

describe('external resources', function() {

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

    function imageCompareFn(fixture, done) {
        return function(err, res) {
            if (err) {
                return done(err);
            }
            assert.imageEqualsFile(res.body, './test/fixtures/' + fixture, IMAGE_EQUALS_TOLERANCE_PER_MIL, done);
        };
    }

    it("basic external resource", function(done) {

        var circleStyle = "#test_table_3 { marker-file: url('http://localhost:" + res_serv_port +
            "/circle.svg'); marker-transform:'scale(0.2)'; }";

        testClient.getTile(testClient.defaultTableMapConfig('test_table_3', circleStyle), 13, 4011, 3088,
            imageCompareFn('test_table_13_4011_3088_svg1.png', done));
    });

    it("different external resource", function(done) {

        var squareStyle = "#test_table_3 { marker-file: url('http://localhost:" + res_serv_port +
            "/square.svg'); marker-transform:'scale(0.2)'; }";

        testClient.getTile(testClient.defaultTableMapConfig('test_table_3', squareStyle), 13, 4011, 3088,
            imageCompareFn('test_table_13_4011_3088_svg2.png', done));
    });

    // See http://github.com/CartoDB/Windshaft/issues/107
    it("external resources get localized on renderer creation if not locally cached", function(done) {

        var options = {
            serverOptions: ServerOptions
        };

        var externalResourceStyle = "#test_table_3{marker-file: url('http://localhost:" + res_serv_port +
          "/square.svg'); marker-transform:'scale(0.2)'; }";

        var externalResourceMapConfig = testClient.defaultTableMapConfig('test_table_3', externalResourceStyle);

        testClient.createLayergroup(externalResourceMapConfig, options, function() {
            var externalResourceRequestsCount = res_serv_status.numrequests;

            testClient.createLayergroup(externalResourceMapConfig, options, function() {
                assert.equal(res_serv_status.numrequests, externalResourceRequestsCount);

                // reset resources cache
                rmdir_recursive_sync(global.environment.millstone.cache_basedir);

                testClient.createLayergroup(externalResourceMapConfig, options, function() {
                    assert.equal(res_serv_status.numrequests, externalResourceRequestsCount + 1);

                    done();
                });
            });
        });
    });

    it("referencing unexistant external resources returns an error", function(done) {
        var url = "http://localhost:" + res_serv_port + "/notfound.png";
        var style = "#test_table_3{marker-file: url('" + url + "'); marker-transform:'scale(0.2)'; }";

        var mapConfig = testClient.defaultTableMapConfig('test_table_3', style);

        testClient.createLayergroup(mapConfig, { statusCode: 400 }, function(err, res) {
            assert.deepEqual(JSON.parse(res.body), {
                errors: ["Unable to download '" + url + "' for 'style0' (server returned 404)"]
            });
            done();
        });
    });


    after(function(done) {
        rmdir_recursive_sync(global.environment.millstone.cache_basedir);

        // Close the resources server
        res_serv.close(done);
    });
});

