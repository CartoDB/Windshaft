require('../support/test_helper');

var assert = require('../support/assert');
var TestClient = require('../support/test_client');

describe('turbo-cartocss', function() {

    it('should create a layergroup with turbo-cartocss parsed properly', function(done) {
        var mapConfig = {
            "version": "1.4.0",
            "layers": [
                {
                    "type": 'mapnik',
                    "options": {
                        "cartocss_version": '2.3.0',
                        "sql": "select * from test_table",
                        "cartocss": '#layer { marker-fill: ramp([price], colorbrewer(Greens), jenks); }'
                    }
                }
            ]
        };

        var testClient = new TestClient(mapConfig);

        testClient.createLayergroup(function (err) {
            assert.ok(!err);
            done();
        });
    });
});
