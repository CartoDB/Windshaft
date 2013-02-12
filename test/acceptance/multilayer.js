// FLUSHALL Redis before starting

var   assert        = require('../support/assert')
    , tests         = module.exports = {}
    , _             = require('underscore')
    , querystring   = require('querystring')
    , fs            = require('fs')
    , redis         = require('redis')
    , th            = require('../support/test_helper')
    , Step          = require('step')
    , mapnik        = require('mapnik')
    , Windshaft     = require('../../lib/windshaft')
    , ServerOptions = require('../support/server_options')
    , semver        = require('semver')
    , http          = require('http');

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
    var res_serv_port = 8033; // FIXME: make configurable ?

    suiteSetup(function(done) {

      // Check that we start with an empty redis db 
      redis_client.keys("*", function(err, matches) {
          assert.equal(matches.length, 0, "redis keys present at setup time:\n" + matches.join("\n"));
      });

      // Start a server to test external resources
      res_serv = http.createServer( function(request, response) {
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
      res_serv.listen(res_serv_port, done);

    });


    ////////////////////////////////////////////////////////////////////
    //
    // POST LAYERGROUP
    //
    ////////////////////////////////////////////////////////////////////

    test("post layergroup with 2 layers, each with its style", function(done) {

      var layergroup =  {
        version: '1.0.0',
        layers: [
           { options: {
               sql: 'select * from test_table limit 2',
               cartocss: '#layer { marker-fill:blue; }', 
               cartocss_version: '2.0.2' 
             } },
           { options: {
               sql: 'select * from test_table limit 2 offset 2',
               cartocss: '#layer { marker-fill:red; }', 
               cartocss_version: '2.0.1' 
             } }
        ]
      };

      var expected_token = "d3ee38d12a9671acb668b14df69c3ade";
      Step(
        function do_post()
        {
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup',
              method: 'POST',
              headers: {'Content-Type': 'application/x-www-form-urlencoded' },
              data: querystring.stringify({ config: JSON.stringify(layergroup) })
          }, {}, function(res) {
              assert.equal(res.statusCode, 200, res.body);
              var parsedBody = JSON.parse(res.body);
              assert.deepEqual(parsedBody, {token: expected_token});
              next(null, res);
          });
        },
        function finish(err) {
          var errors = [];
          if ( err ) errors.push(err.message);
          redis_client.keys("map_style|windshaft_test|~" + expected_token, function(err, matches) {
              if ( err ) errors.push(err.message);
              assert.equal(matches.length, 1, "Missing expected token " + expected_token + " from redis");
              redis_client.del(matches, function(err) {
                if ( err ) errors.push(err.message);
                if ( errors.length ) done(new Error(errors));
                else done(null);
              });
          });
        }
      );
    });

    // TODO: check lifetime of layergroup!

    ////////////////////////////////////////////////////////////////////
    //
    // TEARDOWN
    //
    ////////////////////////////////////////////////////////////////////

    suiteTeardown(function(done) {

      // Close the resources server
      res_serv.close();

      // Check that we left the redis db empty
      redis_client.keys("*", function(err, matches) {
          assert.equal(matches.length, 0, "Left over redis keys:\n" + matches.join("\n"));
          redis_client.flushall(done);
      });

    });
});

