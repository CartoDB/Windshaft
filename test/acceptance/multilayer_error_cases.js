require('../support/test_helper');

var assert = require('../support/assert');
var step = require('step');
var Windshaft = require('../../lib/windshaft');
var ServerOptions = require('../support/server_options');
var testClient = require('../support/test_client');

describe('multilayer error cases', function() {

    var server = new Windshaft.Server(ServerOptions);
    server.setMaxListeners(0);

    it("post layergroup with wrong Content-Type", function(done) {
        assert.response(server, {
            url: '/database/windshaft_test/layergroup',
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded' }
        }, {}, function(res) {
            assert.equal(res.statusCode, 400, res.body);
            var parsedBody = JSON.parse(res.body);
            assert.deepEqual(parsedBody, {"errors":["layergroup POST data must be of type application/json"]});
            done();
        });
    });

    it("post layergroup with no layers", function(done) {
        assert.response(server, {
            url: '/database/windshaft_test/layergroup',
            method: 'POST',
            headers: {'Content-Type': 'application/json' }
        }, {}, function(res) {
            assert.equal(res.statusCode, 400, res.body);
            var parsedBody = JSON.parse(res.body);
            assert.deepEqual(parsedBody, {"errors":["Missing layers array from layergroup config"]});
            done();
        });
    });

    it("post layergroup jsonp errors are returned with 200 status", function(done) {
        assert.response(server, {
            url: '/database/windshaft_test/layergroup?callback=test',
            method: 'POST',
            headers: {'Content-Type': 'application/json' }
        }, {}, function(res) {
            assert.equal(res.statusCode, 200);
            assert.equal(res.body, 'test({"errors":["Missing layers array from layergroup config"]});');
            done();
        });
    });

    // See https://github.com/CartoDB/Windshaft/issues/154
    it("mapnik tokens cannot be used with attributes service", function(done) {
      var layergroup =  {
        version: '1.1.0',
        layers: [
           { options: {
               sql: 'select cartodb_id, 1 as n, the_geom, !bbox! as b from test_table limit 1',
               cartocss: '#layer { marker-fill:red }',
               cartocss_version: '2.0.1',
               attributes: { id:'cartodb_id', columns:['n'] }
             } }
        ]
      };
      step(
        function do_post()
        {
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup',
              method: 'POST',
              headers: {'Content-Type': 'application/json; charset=utf-8' },
              data: JSON.stringify(layergroup)
          }, {}, function(res, err) { next(err, res); });
        },
        function do_check(err, res) {
          assert.equal(res.statusCode, 400, res.body);
          var parsed = JSON.parse(res.body);
          assert.ok(parsed.errors);
          assert.equal(parsed.errors.length, 1);
          var msg = parsed.errors[0];
          assert.ok(msg.match(/Attribute service cannot be activated/), msg);
          return null;
        },
        function finish(err) {
          done(err);
        }
      );
    });

    it("layergroup with no cartocss_version", function(done) {
      var layergroup =  {
        version: '1.0.0',
        layers: [
           { options: {
               sql: 'select cartodb_id, ST_Translate(the_geom, 50, 0) as the_geom from test_table limit 2',
               cartocss: '#layer { marker-fill:red; marker-width:32; marker-allow-overlap:true; }'
             } }
        ]
      };
      assert.response(server, {
          url: '/database/windshaft_test/layergroup',
          method: 'POST',
          headers: {'Content-Type': 'application/json' },
          data: JSON.stringify(layergroup)
      }, {}, function(res) {
          assert.equal(res.statusCode, 400, res.body);
          var parsedBody = JSON.parse(res.body);
          assert.deepEqual(parsedBody, {errors:["Missing cartocss_version for layer 0 options"]});
          done();
      });
    });

    it("sql/cartocss combination errors", function(done) {
      var layergroup =  {
        version: '1.0.1',
        layers: [{ options: {
           sql: "select 1 as i, 'LINESTRING(0 0, 1 0)'::geometry as the_geom",
           cartocss_version: '2.0.2',
           cartocss: '#layer [missing=1] { line-width:16; }'
        }}]
      };
      server.afterLayergroupCreateCalls = 0;
      assert.response(server, {
          url: '/database/windshaft_test/layergroup',
          method: 'POST',
          headers: {'Content-Type': 'application/json' },
          data: JSON.stringify(layergroup)
      }, {}, function(res) {
        try {
          assert.equal(res.statusCode, 400, res.statusCode + ': ' + res.body);
          // See http://github.com/CartoDB/Windshaft/issues/159
          assert.equal(server.afterLayergroupCreateCalls, 0);
          var parsed = JSON.parse(res.body);
          assert.ok(parsed);
          assert.equal(parsed.errors.length, 1);
          var error = parsed.errors[0];
          assert.ok(error.match(/column "missing" does not exist/m), error);
          // cannot check for error starting with style0 until a new enough mapnik
          // is used: https://github.com/mapnik/mapnik/issues/1924
          //assert.ok(error.match(/^style0/), "Error doesn't start with style0: " + error);
          // TODO: check which layer introduced the problem ?
          done();
        } catch (err) { done(err); }
      });
    });

    it("sql/interactivity combination error", function(done) {
      var layergroup =  {
        version: '1.0.1',
        layers: [
          { options: {
           sql: "select 1 as i, st_setsrid('LINESTRING(0 0, 1 0)'::geometry, 4326) as the_geom",
           cartocss_version: '2.0.2',
           cartocss: '#layer { line-width:16; }',
           interactivity: 'i'
          }},
          { options: {
           sql: "select 1 as i, st_setsrid('LINESTRING(0 0, 1 0)'::geometry, 4326) as the_geom",
           cartocss_version: '2.0.2',
           cartocss: '#layer { line-width:16; }'
          }},
          { options: {
           sql: "select 1 as i, st_setsrid('LINESTRING(0 0, 1 0)'::geometry, 4326) as the_geom",
           cartocss_version: '2.0.2',
           cartocss: '#layer { line-width:16; }',
           interactivity: 'missing'
          }}
        ]
      };
      server.afterLayergroupCreateCalls = 0;
      assert.response(server, {
          url: '/database/windshaft_test/layergroup',
          method: 'POST',
          headers: {'Content-Type': 'application/json' },
          data: JSON.stringify(layergroup)
      }, {}, function(res) {
        try {
          assert.equal(res.statusCode, 400, res.statusCode + ': ' + res.body);
          // See http://github.com/CartoDB/Windshaft/issues/159
          assert.equal(server.afterLayergroupCreateCalls, 0);
          var parsed = JSON.parse(res.body);
          assert.ok(parsed);
          assert.equal(parsed.errors.length, 1);
          var error = parsed.errors[0];
          assert.ok(error.match(/column "missing" does not exist/m), error);
          // TODO: check which layer introduced the problem ?
          done();
        } catch (err) { done(err); }
      });
    });

    it("blank CartoCSS error", function(done) {
      var layergroup =  {
        version: '1.0.1',
        layers: [
          { options: {
           sql: "select 1 as i, 'LINESTRING(0 0, 1 0)'::geometry as the_geom",
           cartocss_version: '2.0.2',
           cartocss: '#style { line-width:16 }',
           interactivity: 'i'
          }},
          { options: {
           sql: "select 1 as i, 'LINESTRING(0 0, 1 0)'::geometry as the_geom",
           cartocss_version: '2.0.2',
           cartocss: '',
           interactivity: 'i'
          }}
        ]
      };
      assert.response(server, {
          url: '/database/windshaft_test/layergroup',
          method: 'POST',
          headers: {'Content-Type': 'application/json' },
          data: JSON.stringify(layergroup)
      }, {}, function(res) {
        try {
          assert.equal(res.statusCode, 400, res.statusCode + ': ' + res.body);
          var parsed = JSON.parse(res.body);
          assert.ok(parsed);
          assert.equal(parsed.errors.length, 1);
          var error = parsed.errors[0];
          assert.ok(error.match(/^style1: CartoCSS is empty/), error);
          done();
        } catch (err) { done(err); }
      });
    });

    it("Invalid mapnik-geometry-type CartoCSS error", function(done) {
      var layergroup =  {
        version: '1.0.1',
        layers: [
          { options: {
           sql: "select 1 as i, 'LINESTRING(0 0, 1 0)'::geometry as the_geom",
           cartocss_version: '2.0.2',
           cartocss: '#style [mapnik-geometry-type=bogus] { line-width:16 }'
          }},
          { options: {
           sql: "select 1 as i, 'LINESTRING(0 0, 1 0)'::geometry as the_geom",
           cartocss_version: '2.0.2',
           cartocss: '#style [mapnik-geometry-type=bogus] { line-width:16 }'
          }}
        ]
      };
      assert.response(server, {
          url: '/database/windshaft_test/layergroup',
          method: 'POST',
          headers: {'Content-Type': 'application/json' },
          data: JSON.stringify(layergroup)
      }, {}, function(res) {
        try {
          assert.equal(res.statusCode, 400, res.statusCode + ': ' + res.body);
          var parsed = JSON.parse(res.body);
          assert.ok(parsed);
          assert.equal(parsed.errors.length, 1);
          var error = parsed.errors[0];
          // carto-0.9.3 used to say "Failed to parse expression",
          // carto-0.9.5 says "not a valid keyword"
          assert.ok(error.match(/^style0:.*(Failed|not a valid)/), error);
          // TODO: check which layer introduced the problem ?
          done();
        } catch (err) { done(err); }
      });
    });

    it("post'ing style with non existent column in filter returns 400 with error", function(done) {
        var layergroup =  {
            version: '1.0.1',
            layers: [
                { options: {
                    sql: 'select * from test_table limit 1',
                    cartocss: '#test_table::outline[address="one"], [address="two"] { marker-fill: red; }',
                    cartocss_version: '2.0.2',
                    interactivity: [ 'cartodb_id' ]
                } },
                { options: {
                    sql: 'select * from test_big_poly limit 1',
                    cartocss: '#test_big_poly { marker-fill:blue }',
                    cartocss_version: '2.0.2',
                    interactivity: [ 'cartodb_id' ]
                } }
            ]
        };

        assert.response(server, {
            url: '/database/windshaft_test/layergroup',
            method: 'POST',
            headers: {'Content-Type': 'application/json' },
            data: JSON.stringify(layergroup)
        }, {}, function(res) {
            assert.equal(res.statusCode, 400, res.body);
            var parsed = JSON.parse(res.body);
            assert.equal(parsed.errors.length, 1);
            var error = parsed.errors[0];
            assert.ok(error.match(/column "address" does not exist/m), error);
            done();
        });
    });

    // See https://github.com/Vizzuality/Windshaft/issues/31
    it('bogus sql raises 400 status code', function(done) {
        var bogusSqlMapConfig = testClient.singleLayerMapConfig('BOGUS FROM test_table');
        testClient.createLayergroup(bogusSqlMapConfig, { statusCode: 400 }, function(err, res) {
            assert.ok(/syntax error/.test(res.body), "Unexpected error: " + res.body);
            done();
        });
    });

    it('bogus sql raises 200 status code for jsonp', function(done) {
        var bogusSqlMapConfig = testClient.singleLayerMapConfig('bogus');
        var options = {
            method: 'GET',
            callbackName: 'test',
            headers: {
                'Content-Type': 'text/javascript; charset=utf-8'
            }
        };
        testClient.createLayergroup(bogusSqlMapConfig, options, function(err, res) {
            assert.ok(/^test\(/.test(res.body), "Body start expected callback name: " + res.body);
            assert.ok(/syntax error/.test(res.body), "Unexpected error: " + res.body);
            done();
        });
    });

    it('query not selecting the_geom raises 200 status code for jsonp instead of 404', function(done) {
        var noGeomMapConfig = testClient.singleLayerMapConfig('select null::geometry the_geom_wadus');
        var options = {
            method: 'GET',
            callbackName: 'test',
            headers: {
                'Content-Type': 'text/javascript; charset=utf-8'
            }
        };
        testClient.createLayergroup(noGeomMapConfig, options, function(err, res) {
            assert.ok(/^test\(/.test(res.body), "Body start expected callback name: " + res.body);
            assert.ok(/column.*does not exist/.test(res.body), "Unexpected error: " + res.body);
            done();
        });
    });

    it("query with no geometry field returns 400 status",  function(done){
        var noGeometrySqlMapConfig = testClient.singleLayerMapConfig('SELECT 1');
        testClient.createLayergroup(noGeometrySqlMapConfig, { statusCode: 400 }, function(err, res) {
            assert.ok(/column.*does not exist/.test(res.body), "Unexpected error: " + res.body);
            done();
        });
    });

    it("bogus style should raise 400 status",  function(done){
        var bogusStyleMapConfig = testClient.defaultTableMapConfig('test_table', '#test_table{xxxxx;}');
        testClient.createLayergroup(bogusStyleMapConfig, { method: 'GET', statusCode: 400 }, done);
    });

    var defaultErrorExpectedResponse = {
        status: 400,
        headers: {
            'Content-Type': 'application/json; charset=utf-8'
        }
    };

    it('should raise 400 error for out of bounds layer index',  function(done){
        var mapConfig = testClient.singleLayerMapConfig('select * from test_table', null, null, 'name');

        testClient.getGrid(mapConfig, 1, 13, 4011, 3088, defaultErrorExpectedResponse, function(err, res) {
            assert.deepEqual(JSON.parse(res.body), { errors: ["Layer '1' not found in layergroup"] });
            done();
        });
    });

    ////////////////////////////////////////////////////////////////////
    //
    // OPTIONS LAYERGROUP
    //
    ////////////////////////////////////////////////////////////////////

    it("nonexistent layergroup token error", function(done) {
      step(
        function do_get_tile(err)
        {
          assert.ifError(err);
          var next = this;
          assert.response(server, {
              url: '/database/windshaft_test/layergroup/deadbeef/0/0/0/0.grid.json',
              method: 'GET',
              encoding: 'binary'
          }, {}, function(res, err) { next(err, res); });
        },
        function checkResponse(err, res) {
          assert.ifError(err);
          // FIXME: should be 404
          assert.equal(res.statusCode, 400, res.statusCode + ':' + res.body);
          var parsed = JSON.parse(res.body);
          assert.deepEqual(parsed, {"errors": ["Invalid or nonexistent map configuration token 'deadbeef'"]});
          return null;
        },
        function finish(err) {
          done(err);
        }
      );
    });

    it('error 400 on json syntax error', function(done) {
        var layergroup =  {
            version: '1.0.1',
            layers: [
                {
                    options: {
                        sql: 'select the_geom from test_table limit 1',
                        cartocss: '#layer { marker-fill:red }'
                    }
                }
            ]
        };
        assert.response(server,
            {
                url: '/database/windshaft_test/layergroup',
                method: 'POST',
                headers: {'Content-Type': 'application/json; charset=utf-8' },
                data: '{' + JSON.stringify(layergroup)
            },
            {
                status: 400
            },
            function(res) {
                var parsedBody = JSON.parse(res.body);
                assert.deepEqual(parsedBody, { errors: ['SyntaxError: Unexpected token {'] });
                done();
            }
        );
    });

});
