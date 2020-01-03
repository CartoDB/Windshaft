'use strict';

require('../support/test-helper');

const mapnik = require('@carto/mapnik');

const assert = require('../support/assert');
const TestClient = require('../support/test-client');

describe('layer filtering regressions', () => {
    const mapConfig = {
        version: '1.6.0',
        layers: [
            {
                id: 'layerA',
                type: 'mapnik',
                options: {
                    sql: 'select * from test_table'
                }
            },
            {
                id: 'layerB',
                type: 'mapnik',
                options: {
                    sql: 'select * from test_table limit 1'
                }
            }
        ]
    };

    const scenarios = [
        {
            layers: 'layerA',
            features: [5]
        },
        {
            layers: 'layerB',
            features: [1]
        },
        {
            layers: 'layerA,layerB',
            features: [5, 1]
        }
    ];

    scenarios.forEach(scenario => {
        it(`should work with mapnik layer ids: ${scenario.layers}`, function (done) {
            const testClient = new TestClient(mapConfig);
            testClient.getTile(0, 0, 0, { layer: scenario.layers, format: 'mvt' }, function (err, mvtTile) {
                assert.ifError(err);

                const vtile = new mapnik.VectorTile(0, 0, 0);
                vtile.setData(mvtTile);
                assert.equal(vtile.painted(), true);
                assert.equal(vtile.empty(), false);

                const result = vtile.toJSON();
                assert.equal(result.length, scenario.features.length);

                scenario.features.forEach((count, i) => {
                    const layer = result[i];
                    assert.equal(layer.features.length, count);
                });

                done();
            });
        });
    });
});
