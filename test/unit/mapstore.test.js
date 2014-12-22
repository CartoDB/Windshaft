var   _             = require('underscore')
    , sys           = require('util')
    , th            = require('../support/test_helper.js')
    , RedisPool     = require('redis-mpool')
    , assert        = require('assert')
    , redis         = require('redis')
    , Step          = require('step')
    , serverOptions = require('../support/server_options')
    , MapStore      = require('../../lib/windshaft/storages/mapstore')
    , MapConfig     = require('../../lib/windshaft/mapconfig')
;

suite('mapstore', function() {
 
    var redis_client = redis.createClient(serverOptions.redis.port);
    var redis_pool = new RedisPool(serverOptions.redis);

    suiteSetup(function(done) {
      // Check that we start with an empty redis db 
      redis_client.keys("*", function(err, matches) {
          assert.equal(matches.length, 0);
          done();
      });
    });

    test('fails loading unexistent map', function(done){
      var map_store = new MapStore({pool:redis_pool, expire_time:50000});
      Step(
        function getMap() {
          map_store.load('unexistent', this);
        },
        function checkErr(err) {
          assert.ok(err);
          return null;
        },
        function finish(err) {
          done(err);
        }
      );
    });

    test('can save a map and tell if it existed already', function(done) {
      var map_store = new MapStore({pool:redis_pool, expire_time:50000});
      var map = new MapConfig({
        version: '1.0.1',
        layers: [
           { options: {
               sql: 'select the_geom from test_table limit 1',
               cartocss: '#layer { marker-fill:red }',
               cartocss_version: '2.0.1'
             } }
        ]
      });
      var mapID;
      Step(
        function saveMap() {
          map_store.save(map, this);
        },
        function checkSaved_reSave(err, id, known) {
          if ( err ) throw err;
          mapID = id;
          assert.ok(!known);
          map_store.save(map, this);
        },
        function checkReSaved(err, id, known) {
          if ( err ) throw err;
          assert.ok(known);
          return null;
        },
        function delMap(err) {
          var next = this;
          map_store.del(mapID, function(e) {
            if ( e ) console.log("Could not delete map " + mapID + ": " + e);
            next(err);
          });
        },
        function finish(err) {
          done(err);
        }
      );
    });

    suiteTeardown(function(done) {
      // Flush redis cache
      // See https://github.com/Vizzuality/Windshaft/issues/24
      redis_client.flushall(done);
    });

});

