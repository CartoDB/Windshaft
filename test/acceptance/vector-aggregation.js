require('../support/test_helper');

var assert = require('../support/assert');
var TestClient = require('../support/test_client');

describe('vector aggregation', function () {
    it('should create a single layer map w/o cartocss', function (done) {
        this.testClient = new TestClient({
            version: '1.6.0',
            layers: [
               {
                    type: 'cartodb',
                    options: {
                        sql: 'select st_setsrid(st_makepoint(0, 0), 4326) as the_geom'
                    }
                }
            ]
        });

        this.testClient.createLayergroup((err, layergroup) => {
            if (err) {
                return done(err);
            }

            assert.ok(layergroup);
            assert.ok(layergroup.layergroupid);

            done();
        });
    });
});
