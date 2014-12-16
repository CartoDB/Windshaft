var assert = require('assert');
var TorqueFactory = require('../../lib/windshaft/renderers/torque').factory;

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

  var mapConfig_notorque = {
    layers: [
      {
        type: 'cartodb',
        options: {
          sql: 'select * from table',
          cartocss: ['#layer { marker-fill: #000; }'].join(''),
          cartocss_version: '2.1.1'
        }
      }
    ]
  };


  var mapConfig = {
    layers: [
      {
        type: 'torque',
        options: {
          sql: 'select * from table',
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
    torque = new TorqueFactory({
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
      torque.getRenderer(mapConfig, {}, 'json.torque', 0, function(err, renderer) {
        assert.ok(!err, err);
        assert.ok(!!renderer);
        assert.ok(!!renderer.getTile);
        done();
      });
    });

    it("should raise an error on missing -torque-frame-count", function(done) {
      sqlApi.responses = [
        [null, { fields: { 'date': { type: 'date' } } }],
        [null, { rows: [
          { min_date: 0, max_date: 10, num_steps: 1, xmin: 0, xmax: 10, ymin: 0, ymax: 10 }
          ]
        }]
      ];
      var brokenConfig = JSON.parse(JSON.stringify(mapConfig).replace(/-torque-frame-count:[^;]*;/, ''));
      torque.getRenderer(brokenConfig, {}, 'json.torque', 0, function(err, renderer) {
        assert.ok(err !== null);
        assert.ok(err instanceof Error);
        assert.equal(err.message, "Missing required property '-torque-frame-count' in torque layer CartoCSS");
        done();
      });
    });

    it("should raise an error on missing -torque-resolution", function(done) {
      sqlApi.responses = [
        [null, { fields: { 'date': { type: 'date' } } }],
        [null, { rows: [
          { min_date: 0, max_date: 10, num_steps: 1, xmin: 0, xmax: 10, ymin: 0, ymax: 10 }
          ]
        }]
      ];
      var brokenConfig = JSON.parse(JSON.stringify(mapConfig).replace(/-torque-resolution:[^;]*;/, ''));
      torque.getRenderer(brokenConfig, {}, 'json.torque', 0, function(err, renderer) {
        assert.ok(err !== null);
        assert.ok(err instanceof Error);
        assert.equal(err.message, "Missing required property '-torque-resolution' in torque layer CartoCSS");
        done();
      });
    });

    it("should raise an error on missing -torque-time-attribute", function(done) {
      sqlApi.responses = [
        [null, { fields: { 'date': { type: 'date' } } }],
        [null, { rows: [
          { min_date: 0, max_date: 10, num_steps: 1, xmin: 0, xmax: 10, ymin: 0, ymax: 10 }
          ]
        }]
      ];
      var brokenConfig = JSON.parse(JSON.stringify(mapConfig).replace(/-torque-time-attribute:[^;]*;/, ''));
      torque.getRenderer(brokenConfig, {}, 'json.torque', 0, function(err, renderer) {
        assert.ok(err !== null);
        assert.ok(err instanceof Error);
        assert.equal(err.message, "Missing required property '-torque-time-attribute' in torque layer CartoCSS");
        done();
      });
    });

    it('should return error when format is unsuported', function(done) {
      torque.getRenderer(mapConfig, {}, 'dummy', 0, function(err, renderer) {
        assert.ok(err !== null);
        assert.ok(err instanceof Error);
        assert.ok(err.message == "format not supported: dummy");
        done();
      });
    });

    it("should raise an error when layer is not set", function(done) {
      torque.getRenderer(mapConfig_notorque, {}, 'json.torque', function(err, renderer) {
        assert.ok(err !== null);
        assert.ok(err instanceof Error);
        assert.ok(err.message == "torque renderer only supports a single layer");
        done();
      });
    });
    it("should raise an error when layer does not exist", function(done) {
      torque.getRenderer(mapConfig, {}, 'json.torque', 1, function(err, renderer) {
        assert.ok(err !== null);
        assert.ok(err instanceof Error);
        assert.ok(err.message == "layer index is greater than number of layers");
        done();
      });
    });

  });

  describe('Renderer', function() {
    it('should get metadata', function(done) {
      sqlApi.responses = [
        [null, { fields: { 'date': { type: 'date' } } }],
        [null, { rows: [
          { min_date: 0, max_date: 10, num_steps: 1, xmin: 0, xmax: 10, ymin: 0, ymax: 10 }
          ]
        }]
      ]
      torque.getRenderer(mapConfig, {}, 'json.torque', 0, function(err, renderer) {
        assert.ok(err === null);
        renderer.getMetadata(function(err, m) {
          assert.equal(0, m.start)
          assert.equal(10000, m.end)
          assert.equal(1, m.data_steps)
          assert.equal('date', m.column_type);
          done();
        })
      });

    })
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
      torque.getRenderer(mapConfig, {}, 'json.torque', 0, function(err, renderer) {
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

    it('should not get Infinity steps', function(done) {
        var mapConfig = {
            layers: [
                {
                    type: 'torque',
                    options: {
                        sql: "select * from test_table LIMIT 0",
                        cartocss: [
                            "Map {" +
                                "-torque-frame-count:1;" +
                                "-torque-resolution:1;" +
                                "-torque-aggregation-function:'count(*)';" +
                                "-torque-time-attribute:'updated_at';" +
                            "}"
                        ].join('')
                    },
                    cartocss_version: '2.1.1'
                }

            ]
        };

        sqlApi.responses = [
            [null, { fields: { updated_at: { type: "date" } } }],
            [null, { rows: [ { num_steps: 0, max_date: null, min_date: null } ] }]
        ];
        torque.getRenderer(mapConfig, {}, 'json.torque', 0, function(err, renderer) {
            assert.equal(renderer.attrs.step, 1, 'Number of steps cannot be Infinity');
            done();
        });
    });

  });

});
