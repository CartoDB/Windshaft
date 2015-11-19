require('../support/test_helper');

var _ = require('underscore');
var assert = require('../support/assert');
var TestClient = require('../support/test_client');

describe('Create mapnik layergroup', function() {
    var mapConfig = TestClient.singleLayerMapConfig('select * from test_table limit 2');

    it('should response with meta-stats', function(done) {
        var testClient = new TestClient(mapConfig, {
            mapnik: {
                mapnik: _.extend({}, TestClient.mapnikOptions)
            }
        });
        
        testClient.createLayergroup(function(err, layergroup) {
            assert.ok(!err);
            assert.ok(layergroup.metadata.layers[0].meta.stats[0].features === 5);
            done();
        });
    });

});
