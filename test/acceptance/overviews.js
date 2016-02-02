require('../support/test_helper');

var _ = require('underscore');
var assert = require('../support/assert');
var TestClient = require('../support/test_client');
var OverviewsHandler = require('../../lib/windshaft/utils/overviews_handler');
var rendererOptions = global.environment.renderer;

describe('server_gettile', function() {

    var IMAGE_EQUALS_TOLERANCE_PER_MIL = 2;

    function imageCompareFn(fixture, done) {
        return function(err, tile) {
            if (err) {
                return done(err);
            }
            assert.imageEqualsFile(tile, './test/fixtures/' + fixture, IMAGE_EQUALS_TOLERANCE_PER_MIL, done);
        };
    }

    it("should use the overview tables",  function(done){
        var overviewsHandler = new OverviewsHandler({ zoom_level: '11' });
        var options = {
            mapnik: {
                mapnik: _.extend({}, rendererOptions.mapnik, { overviewsHandler: overviewsHandler })
            }
        };
        var mapConfig = TestClient.singleLayerMapConfig('SELECT * FROM test_table');


        mapConfig.layers[0].options.overviews = {
            test_table: {
                12: { table: '_vovw_12_test_table' }
            }
        };
        new TestClient(mapConfig, options)
            .getTile(11, 1002, 772, imageCompareFn('_vovw_12_test_table_11_1002_772.png', done));

    });

    it("should not use the overview tables for higher zoom levels",  function(done){
        var overviewsHandler = new OverviewsHandler({ zoom_level: '13' });
        var options = {
            mapnik: {
                mapnik: _.extend({}, rendererOptions.mapnik, { overviewsHandler: overviewsHandler })
            }
        };
        var mapConfig = TestClient.singleLayerMapConfig('SELECT * FROM test_table');
        mapConfig.layers[0].options.overviews = {
            test_table: {
                12: { table: '_vovw_12_test_table' }
            }
        };
        new TestClient(mapConfig, options)
            .getTile(11, 1002, 772, imageCompareFn('test_table_11_1002_772.png', done));
    });

});
