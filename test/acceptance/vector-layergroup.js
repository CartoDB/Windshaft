'use strict';

require('../support/test_helper');

const assert = require('../support/assert');
const mapnik = require('@carto/mapnik');
const TestClient = require('../support/test_client');
const invalidFormatErrorTemplate = format => `Unsupported format: 'cartocss' option is missing for ${format}`;
const INCOMPATIBLE_LAYERS_ERROR = 'The `mapnik` or `cartodb` layers must be consistent:' +
    ' `cartocss` option is either present or voided in all layers. Mixing is not allowed.';
const POINTS_SQL_1 = `
select
    st_setsrid(st_makepoint(x*10, x*10), 4326) as the_geom,
    st_transform(st_setsrid(st_makepoint(x*10, x*10), 4326), 3857) as the_geom_webmercator,
    x as value
from generate_series(-3, 3) x
`;

const POINTS_SQL_2 = `
select
    st_setsrid(st_makepoint(x*10, x*10*(-1)), 4326) as the_geom,
    st_transform(st_setsrid(st_makepoint(x*10, x*10*(-1)), 4326), 3857) as the_geom_webmercator,
    x as value
from generate_series(-3, 3) x
`;

describe('mvt (mapnik)', function () {
    mvtTest(false);
});

describe('mvt (pgsql)', function () {
    mvtTest(true);
});

function mvtTest (usePostGIS) {
    const options = { mvt: { usePostGIS: usePostGIS } };

    describe('vector layergroup', function () {
        it('should create a single layer map w/o cartocss', function (done) {
            this.testClient = new TestClient({
                version: '1.6.0',
                layers: [
                    {
                        type: 'cartodb',
                        options: {
                            sql: POINTS_SQL_1
                        }
                    }
                ]
            }, options);

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
                            sql: POINTS_SQL_1
                        }
                    },
                    {
                        type: 'cartodb',
                        options: {
                            sql: POINTS_SQL_2,
                            cartocss: '#layer { marker-fill:blue; marker-allow-overlap:true; }',
                            cartocss_version: '2.0.2'
                        }
                    }
                ]
            }, options);

            this.testClient.createLayergroup((err) => {
                assert.ok(err);
                assert.equal(INCOMPATIBLE_LAYERS_ERROR, err.message);
                done();
            });
        });

        it('should get tile 0/0/0 for a vector layergroup', function (done) {
            this.testClient = new TestClient({
                version: '1.6.0',
                layers: [
                    {
                        type: 'cartodb',
                        options: {
                            sql: POINTS_SQL_1
                        }
                    }
                ]
            }, options);

            this.testClient.getTile(0, 0, 0, { format: 'mvt' }, (err, mvtTile) => {
                if (err) {
                    return done(err);
                }

                var vtile = new mapnik.VectorTile(0, 0, 0);
                vtile.setData(mvtTile);
                assert.equal(vtile.painted(), true);
                assert.equal(vtile.empty(), false);
                done();
            });
        });

        it('should fail when requesting a raster format tile for a vector layergroup', function (done) {
            this.testClient = new TestClient({
                version: '1.6.0',
                layers: [
                    {
                        type: 'cartodb',
                        options: {
                            sql: POINTS_SQL_2

                        }
                    }
                ]
            }, options);

            this.testClient.getTile(0, 0, 0, { format: 'png' }, (err) => {
                assert.ok(err);
                assert.equal(invalidFormatErrorTemplate('png'), err.message);
                assert.equal(400, err.http_status);

                done();
            });
        });
    });
}
