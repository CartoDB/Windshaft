require('../support/test_helper');

var assert = require('../support/assert');
var _ = require('underscore');
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
    }
    else {
        rmdir_recursive_sync(f);
    }
  }
}

describe('regressions', function() {

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

    // See https://github.com/Vizzuality/Windshaft/issues/65
    it("#65 catching non-Error exception doesn't kill the backend", function(done) {
        var mapConfig = testClient.defaultTableMapConfig('test_table');
        testClient.withLayergroup(mapConfig, function(err, requestTile, finish) {
            var options = {
                statusCode: 400,
                contentType: 'application/json; charset=utf-8'
            };
            requestTile('/0/0/0.png?testUnexpectedError=1', options, function(err, res) {
                assert.deepEqual(JSON.parse(res.body), { "errors": ["test unexpected error"] });
                finish(done);
            });
        });
    });

    // Test that you cannot write to the database from a tile request
    //
    // See http://github.com/CartoDB/Windshaft/issues/130
    // [x] Needs a fix on the mapnik side: https://github.com/mapnik/mapnik/pull/2143
    //
    it("#130 database access is read-only", function(done) {

        var writeSqlMapConfig = testClient.singleLayerMapConfig(
            'select st_point(0,0) as the_geom, * from test_table_inserter(st_setsrid(st_point(0,0),4326),\'write\')'
        );

        var expectedResponse = {
            status: 400,
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            }
        };

        testClient.getTile(writeSqlMapConfig, 0, 0, 0, expectedResponse, function(err, res) {
            var parsedBody = JSON.parse(res.body);
            assert.ok(parsedBody.errors);
            assert.equal(parsedBody.errors.length, 1);
            assert.ok(parsedBody.errors[0].match(/read-only transaction/), 'read-only error message expected');
            done();
        });
    });

    // See https://github.com/CartoDB/Windshaft/issues/167
    it("#167 does not die on unexistent statsd host",  function(done) {
        var CustomOptions = _.clone(ServerOptions);
        CustomOptions.statsd = _.clone(CustomOptions.statsd);
        CustomOptions.statsd.host = 'whoami.vizzuality.com';
        CustomOptions.statsd.cacheDns = false;
        var server = new Windshaft.Server(CustomOptions);
        server.setMaxListeners(0);

        var errors = [];
        // We need multiple requests to make sure
        // statsd_client eventually tries to send
        // stats _and_ DNS lookup is given enough
        // time (an interval is used later for that)
        var numreq = 10;
        var pending = numreq;
        var completed = function(err) {
            if ( err ) {
                errors.push(err);
            }
            if ( ! --pending ) {
                setTimeout(function() {
                    done(errors.length ? new Error(errors.join(',')) : null);
                }, 10);
            }
        };
        var mapConfig = testClient.defaultTableMapConfig('test_table');
        for (var i=0; i<numreq; ++i) {
            testClient.createLayergroup(mapConfig, { server: server }, completed);
        }
    });

    // See https://github.com/CartoDB/Windshaft/issues/173
    it("#173 does not send db details in connection error response", function(done) {

        var mapConfig = testClient.defaultTableMapConfig('test_table');

        var CustomOptions = _.clone(ServerOptions);
        CustomOptions.grainstore = _.clone(CustomOptions.grainstore);
        CustomOptions.grainstore.datasource = _.clone(CustomOptions.grainstore.datasource);
        CustomOptions.grainstore.datasource.port = '666';

        var options = {
            statusCode: 400,
            serverOptions: CustomOptions
        };

        testClient.createLayergroup(mapConfig, options, function(err, res, parsedBody) {
            assert.ok(parsedBody.errors);
            var msg = parsedBody.errors[0];
            assert.ok(msg.match(/connect/), msg);
            assert.ok(!msg.match(/666/), msg);

            done();
        });

    });

});
