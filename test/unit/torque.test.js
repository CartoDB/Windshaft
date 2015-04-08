require('../support/test_helper');

var assert = require('assert');
var TorqueFactory = require('../../lib/windshaft/renderers/torque').factory;
var MapConfig = require('../../lib/windshaft/models/mapconfig');

function dummyPSQL() {
  PSQLDummy.n = Date.now();
  function PSQLDummy() {
    this.query = function(sql, callback) {
      var res = PSQLDummy.responses[PSQLDummy.queries.length];
      //console.log("* ", PSQLDummy.n, sql, " => ", res);
      PSQLDummy.queries.push(sql);
      callback.apply(module, res);
    };
  }
  PSQLDummy.queries = [];
  PSQLDummy.responses = [];
  return PSQLDummy;
}

describe('torque', function() {

  var layergroup_notorque = {
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
  var mapConfig_notorque = MapConfig.create(layergroup_notorque);

  function makeCartoCss(mapAttributes) {
      mapAttributes = mapAttributes || [
          '-torque-time-attribute: "date";',
          '-torque-aggregation-function: "count(cartodb_id)";',
          '-torque-frame-count: 760;',
          '-torque-animation-duration: 15;',
          '-torque-resolution: 2'
      ];
      return [
        'Map {',
          mapAttributes.join(' '),
        '}',
        '#layer {',
          'marker-width: 3;',
        '}'
      ].join('');
  }

  function layergroupConfig(cartocss) {
    cartocss = cartocss || makeCartoCss();
    return {
        layers: [
            {
                type: 'torque',
                options: {
                    sql: 'select * from table',
                    cartocss: cartocss,
                    cartocss_version: '2.1.1'
                }
            }
        ]
    };
  }

  var mapConfig = MapConfig.create(layergroupConfig());

  var sqlApi = null;
  var torque = null;
  beforeEach(function(){
    sqlApi = dummyPSQL();
    torque = new TorqueFactory({
      sqlClass: sqlApi
    });
  });

  function rendererOptions(layer) {
    return {
      params: {},
      layer: layer
    };
  }
  var layerZeroOptions = rendererOptions(0);


  describe('getRenderer', function() {

    it('should create a renderer with right parmas', function(done) {
      sqlApi.responses = [
        [null, { fields: { 'date': { type: 'date' } } }],
        [null, { rows: [
          { min_date: 0, max_date: 10, num_steps: 1, xmin: 0, xmax: 10, ymin: 0, ymax: 10 }
          ]
        }]
      ];
      torque.getRenderer(mapConfig, 'json.torque', layerZeroOptions, function(err, renderer) {
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
      var brokenConfig = MapConfig.create(layergroupConfig(makeCartoCss(
          [
              '-torque-time-attribute: "date";',
              '-torque-aggregation-function: "count(cartodb_id)";',
              '-torque-animation-duration: 15;',
              '-torque-resolution: 2'
          ]
      )));
      torque.getRenderer(brokenConfig, 'json.torque', layerZeroOptions, function(err/*, renderer*/) {
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
      var brokenConfig = MapConfig.create(layergroupConfig(makeCartoCss(
          [
              '-torque-time-attribute: "date";',
              '-torque-aggregation-function: "count(cartodb_id)";',
              '-torque-frame-count: 760;',
              '-torque-animation-duration: 15;'
          ]
      )));
      torque.getRenderer(brokenConfig, 'json.torque', layerZeroOptions, function(err/*, renderer*/) {
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
      var brokenConfig = MapConfig.create(layergroupConfig(makeCartoCss(
          [
              '-torque-aggregation-function: "count(cartodb_id)";',
              '-torque-frame-count: 760;',
              '-torque-animation-duration: 15;',
              '-torque-resolution: 2'
          ]
      )));
      torque.getRenderer(brokenConfig, 'json.torque', layerZeroOptions, function(err/*, renderer*/) {
        assert.ok(err !== null);
        assert.ok(err instanceof Error);
        assert.equal(err.message, "Missing required property '-torque-time-attribute' in torque layer CartoCSS");
        done();
      });
    });

    it('should return error when format is unsuported', function(done) {
      torque.getRenderer(mapConfig, 'dummy', layerZeroOptions, function(err/*, renderer*/) {
        assert.ok(err !== null);
        assert.ok(err instanceof Error);
        assert.ok(err.message === "format not supported: dummy");
        done();
      });
    });

    it("should raise an error when layer is not set", function(done) {
      torque.getRenderer(mapConfig_notorque, 'json.torque', {}, function(err/*, renderer*/) {
        assert.ok(err !== null);
        assert.ok(err instanceof Error);
        assert.ok(err.message === "torque renderer only supports a single layer");
        done();
      });
    });
    it("should raise an error when layer does not exist", function(done) {
      torque.getRenderer(mapConfig, 'json.torque', rendererOptions(1), function(err/*, renderer*/) {
        assert.ok(err !== null);
        assert.ok(err instanceof Error);
        assert.ok(err.message === "layer index is greater than number of layers");
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
      ];
      torque.getRenderer(mapConfig, 'json.torque', layerZeroOptions, function(err, renderer) {
        assert.ok(err === null);
        renderer.getMetadata(function(err, m) {
          assert.equal(0, m.start);
          assert.equal(10000, m.end);
          assert.equal(1, m.data_steps);
          assert.equal('date', m.column_type);
          done();
        });
      });

    });
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
      torque.getRenderer(mapConfig, 'json.torque', layerZeroOptions, function(err, renderer) {
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
        var layergroup = {
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
        var mapConfig = MapConfig.create(layergroup);

        sqlApi.responses = [
            [null, { fields: { updated_at: { type: "date" } } }],
            [null, { rows: [ { num_steps: 0, max_date: null, min_date: null } ] }]
        ];
        torque.getRenderer(mapConfig, 'json.torque', layerZeroOptions, function(err, renderer) {
            assert.equal(renderer.attrs.step, 1, 'Number of steps cannot be Infinity');
            done();
        });
    });

  });

});
