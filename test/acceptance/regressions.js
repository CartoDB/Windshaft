require('../support/test_helper');

var assert = require('../support/assert');
var TestClient = require('../support/test_client');

describe('regressions', function() {

    // Test that you cannot write to the database from a tile request
    // See http://github.com/CartoDB/Windshaft/issues/130
    it("#130 database access is read-only", function(done) {
        var writeSqlMapConfig = TestClient.singleLayerMapConfig(
            'select st_point(0,0) as the_geom, * from test_table_inserter(st_setsrid(st_point(0,0),4326),\'write\')'
        );

        var testClient = new TestClient(writeSqlMapConfig);
        testClient.getTile(0, 0, 0, function(err) {
            assert.ok(err);
            assert.ok(err.message.match(/read-only transaction/), 'read-only error message expected');
            done();
        });
    });

});
