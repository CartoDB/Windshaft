require('../support/test_helper.js');

var RedisPool     = require('redis-mpool');
var assert        = require('assert');
var step          = require('step');
var serverOptions = require('../support/server_options');
var MapStore      = require('../../lib/windshaft/storages/mapstore');
var MapConfig     = require('../../lib/windshaft/models/mapconfig');

describe('mapstore', function() {

    var redis_pool = new RedisPool(serverOptions.redis);

    it('fails loading unexistent map', function(done){
      var map_store = new MapStore({pool:redis_pool, expire_time:50000});
      step(
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

    it('can save a map and tell if it existed already', function(done) {
      var map_store = new MapStore({pool:redis_pool, expire_time:50000});
      var map = MapConfig.create({
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
      step(
        function saveMap() {
          map_store.save(map, this);
        },
        function checkSaved_reSave(err, id, known) {
          assert.ifError(err);
          mapID = id;
          assert.ok(!known);
          map_store.save(map, this);
        },
        function checkReSaved(err, id, known) {
          assert.ifError(err);
          assert.ok(known);
          return null;
        },
        function delMap(err) {
          var next = this;
          map_store.del(mapID, function(e) {
            if ( e ) {
                console.log("Could not delete map " + mapID + ": " + e);
            }
            next(err);
          });
        },
        function finish(err) {
          done(err);
        }
      );
    });

});

