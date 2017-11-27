require('../support/test_helper');

var assert = require('../support/assert');
var TestClient = require('../support/test_client');
const INCOMPATIBLE_LAYERS_ERROR =
'The layergroup contains incompatible layers: don\'t mix styled layers with non styled layers (without cartocss)';

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

    it('should fail whether layergroup cantains incompatible layers', function (done) {
        this.testClient = new TestClient({
            version: '1.6.0',
            layers: [
                {
                    type: 'cartodb',
                    options: {
                        sql: 'select st_setsrid(st_makepoint(0, 0), 4326) as the_geom'
                    }
                },
                {
                    type: 'cartodb',
                    options: {
                        sql: 'select st_setsrid(st_makepoint(0, 0), 4326) as the_geom',
                        cartocss: '#layer { marker-fill:blue; marker-allow-overlap:true; }',
                        cartocss_version: '2.0.2',
                    }
                }
            ]
        });

        this.testClient.createLayergroup((err) => {
            assert.ok(err);
            assert.equal(INCOMPATIBLE_LAYERS_ERROR, err.message);
            done();
        });
    });
});
