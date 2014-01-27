var assert = require('assert');
var torque = require('../../lib/windshaft/renderers/torque');

function GenSQL() {
  PSQLDummy.n = Date.now()
  function PSQLDummy() {
    this.query = function(sql, callback) {
      var res = PSQLDummy.responses[PSQLDummy.queries.length];
      //console.log("* ", PSQLDummy.n, sql, " => ", res);
      PSQLDummy.queries.push(sql)
      callback.apply(module, res);
    };
  }
  PSQLDummy.queries = [];
  PSQLDummy.responses = [];
  return PSQLDummy;
}

describe('torque', function() {


  var mapConfig = {
    layers: [
      {
        type: 'torque',
        options: {
          sql: 'select * form table',
          cartocss: ['',
            'Map {',
            '-torque-time-attribute: "date";',
            '-torque-aggregation-function: "count(cartodb_id)";',
            '-torque-frame-count: 760;',
            '-torque-animation-duration: 15;',
            '-torque-resolution: 2',
            '}',
            '#layer {',
            "  marker-width: 3; ",
            '}'
          ].join(''),
          cartocss_version: '2.1.1'
        }
      }
    ]
  };

  var sqlApi = null;
  beforeEach(function(){
    sqlApi = GenSQL();
    torque.initialize({
      sqlClass: sqlApi 
    });
  });


  describe('getRenderer', function() {

    it('should create a renderer with right parmas', function(done) {
      sqlApi.responses = [
        [null, { fields: { 'date': { type: 'date' } } }],
        [null, { rows: [
          { min_date: 0, max_date: 10, num_steps: 1, xmin: 0, xmax: 10, ymin: 0, ymax: 10 }
          ]
        }]
      ];
      torque.getRenderer(mapConfig, {}, 'json.torque', function(err, renderer) {
        assert.ok(err === null);
        assert.ok(!!renderer);
        assert.ok(!!renderer.getTile);
        done();
      });
    });

    it('should return error when format is unsuported', function(done) {
      torque.getRenderer(mapConfig, {}, 'dummy', function(err, renderer) {
        assert.ok(err !== null);
        done();
      });
    });

  });

  describe('Renderer', function() {
    it('should get a tile', function(done) {
      sqlApi.responses = [
        [null, { fields: { 'date': { type: 'date' } } }],
        [null, { rows: [
          { min_date: 0, max_date: 10, num_steps: 1, xmin: 0, xmax: 10, ymin: 0, ymax: 10 }
          ]
        }],
        [null, { rows: [
          { x__uint8: 0, y__uint8: 0, vals__uint8:[0, 1, 2], dates__uint16: [4,5,6] }
          ]
        }]
      ];
      torque.getRenderer(mapConfig, {}, 'json.torque', function(err, renderer) {
        renderer.getTile(0, 0, 0, function(err, tile) {
          assert.ok(err === null);
          assert.ok(!!tile);
          assert.ok(tile[0].x__uint8 !== undefined);
          assert.ok(tile[0].y__uint8 !== undefined);
          assert.ok(tile[0].vals__uint8 !== undefined);
          assert.ok(tile[0].dates__uint16 !== undefined);
          done();
        });
      });
    });

  });

});
