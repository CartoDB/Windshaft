require('../support/test_helper');

const assert = require('../support/assert');
const mapnik = require('mapnik');
const TestClient = require('../support/test_client');
const INVALID_FORMAT_ERROR = 'Invalid format: only mvt format is available for layers without CartoCSS defined';
const INCOMPATIBLE_LAYERS_ERROR =
`The layergroup contains incompatible layers: don\'t mix styled layers with non styled layers (without cartocss)`;
const POLYGONS_SQL = `
    select
        st_buffer(st_setsrid(st_makepoint(x*10, x*10), 4326)::geography, 1000000)::geometry as the_geom
    from generate_series(-3, 3) x
`;
const POINTS_SQL = `
    select
        st_setsrid(st_makepoint(x*10, x*10), 4326) as the_geom
    from generate_series(-3, 3) x
`;


describe('mvt (mapnik)', function () {
    mvtTest(false);
});

if (process.env.POSTGIS_VERSION === '2.4') {
    describe('mvt (pgsql)', function () {
        mvtTest(true);
    });
}

function mvtTest(usePostGIS) {
    const options = { mvt: { usePostGIS: usePostGIS } };

    describe('vector layergroup', function () {
        it('should create a single layer map w/o cartocss', function (done) {
            this.testClient = new TestClient({
                version: '1.6.0',
                layers: [
                    {
                        type: 'cartodb',
                        options: {
                            sql: POINTS_SQL
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
                            sql: POINTS_SQL
                        }
                    },
                    {
                        type: 'cartodb',
                        options: {
                            sql: POINTS_SQL,
                            cartocss: '#layer { marker-fill:blue; marker-allow-overlap:true; }',
                            cartocss_version: '2.0.2',
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
                            sql: 'select st_setsrid(st_makepoint(0, 0), 4326) as the_geom'
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
                            sql: POLYGONS_SQL,

                        }
                    }
                ]
            }, options);

            this.testClient.getTile(0, 0, 0, { format: 'png' }, (err) => {
                assert.ok(err);
                assert.equal(INVALID_FORMAT_ERROR, err.message);
                assert.equal(400, err.http_status);

                done();
            });
        });
    });
};
