'use strict';

require('../support/test_helper');

var mapnik = require('@carto/mapnik');

var assert = require('../support/assert');
var TestClient = require('../support/test_client');

describe('minzoom and maxzoom', function () {
    const getMapConfig = (minzoomA, maxzoomA, minzoomB, maxzoomB) => {
        return {
            version: '1.7.0',
            layers: [
                {
                    id: 'layerA',
                    options: {
                        sql: `
                        SELECT
                            1 as i,
                            ST_SetSRID(ST_MakePoint(-170, 85), 4326) as the_geom,
                            ST_Transform(ST_SetSRID(ST_MakePoint(-170, 85), 4326), 3857) as the_geom_webmercator
                        `,
                        cartocss: '#layer { marker-fill: red; marker-width: 90; marker-allow-overlap: true; }',
                        cartocss_version: '3.0.12',
                        minzoom: minzoomA,
                        maxzoom: maxzoomA
                    }
                },
                {
                    id: 'layerB',
                    options: {
                        sql: `
                        SELECT
                            1 as i,
                            ST_SetSRID(ST_MakePoint(-170, 85), 4326) as the_geom,
                            ST_Transform(ST_SetSRID(ST_MakePoint(-170, 85), 4326), 3857) as the_geom_webmercator
                        `,
                        cartocss: '#layer { marker-fill: green; marker-width: 45; marker-allow-overlap: true; }',
                        cartocss_version: '3.0.12',
                        minzoom: minzoomB,
                        maxzoom: maxzoomB
                    }
                }
            ]
        };
    };

    const scenarios = [
        {
            desc: 'should work with no min neither max zoom, all features present',
            z: 0,
            x: 0,
            y: 0,
            minZoomA: null,
            maxZoomA: null,
            minZoomB: null,
            maxZoomB: null,
            expectedLayers: ['layerA', 'layerB']
        },
        {
            desc: 'should use minzoom=0, features present at zoom=0',
            z: 0,
            x: 0,
            y: 0,
            minZoomA: 0,
            maxZoomA: null,
            minZoomB: 0,
            maxZoomB: null,
            expectedLayers: ['layerA', 'layerB']
        },
        {
            desc: 'should use minzoom=1, empty tile at zoom=0',
            z: 0,
            x: 0,
            y: 0,
            minZoomA: 1,
            maxZoomA: null,
            minZoomB: 1,
            maxZoomB: null,
            expectedLayers: []
        },
        {
            desc: 'should use maxzoom=18, features present at zoom=0',
            z: 0,
            x: 0,
            y: 0,
            minZoomA: null,
            maxZoomA: 18,
            minZoomB: null,
            maxZoomB: 18,
            expectedLayers: ['layerA', 'layerB']
        },
        {
            desc: 'should use maxzoom=1, empty tile at zoom=2',
            z: 2,
            x: 0,
            y: 0,
            minZoomA: null,
            maxZoomA: 1,
            minZoomB: null,
            maxZoomB: 1,
            expectedLayers: []
        },
        {
            desc: 'should work with min zoom and max zoom, empty tile at zoom=0',
            z: 0,
            x: 0,
            y: 0,
            minZoomA: 1,
            maxZoomA: 4,
            minZoomB: 1,
            maxZoomB: 4,
            expectedLayers: []
        },
        {
            desc: 'should work with min zoom and max zoom, all futures present at zoom=2',
            z: 2,
            x: 0,
            y: 0,
            minZoomA: 1,
            maxZoomA: 4,
            minZoomB: 1,
            maxZoomB: 4,
            expectedLayers: ['layerA', 'layerB']
        },
        {
            desc: 'should work with min zoom and max zoom, empty tile at zoom=5',
            z: 5,
            x: 0,
            y: 0,
            minZoomA: 1,
            maxZoomA: 4,
            minZoomB: 1,
            maxZoomB: 4,
            expectedLayers: []
        },
        {
            desc: 'should work with different min zoom and max zoom, layerA at zoom=1',
            z: 1,
            x: 0,
            y: 0,
            minZoomA: 0,
            maxZoomA: 2,
            minZoomB: 2,
            maxZoomB: 4,
            expectedLayers: ['layerA']
        },
        {
            desc: 'should work with different min zoom and max zoom, both layers at zoom=2',
            z: 2,
            x: 0,
            y: 0,
            minZoomA: 0,
            maxZoomA: 2,
            minZoomB: 2,
            maxZoomB: 4,
            expectedLayers: ['layerA', 'layerB']
        },
        {
            desc: 'should work with different min zoom and max zoom, layerB at zoom=4',
            z: 4,
            x: 0,
            y: 0,
            minZoomA: 0,
            maxZoomA: 2,
            minZoomB: 2,
            maxZoomB: 4,
            expectedLayers: ['layerB']
        },
        {
            desc: 'should work with different min zoom and max zoom, empty tile at zoom=5',
            z: 5,
            x: 0,
            y: 0,
            minZoomA: 0,
            maxZoomA: 2,
            minZoomB: 2,
            maxZoomB: 4,
            expectedLayers: []
        }
    ];

    describe('raster tiles', function () {
        const IMAGE_TOLERANCE_PER_MIL = 5;

        const fixturePath = name => `./test/fixtures/zoom-min-max/${name}.png`;

        scenarios.forEach(function (scenario) {
            it(scenario.desc, function (done) {
                const mapconfig = getMapConfig(
                    scenario.minZoomA,
                    scenario.maxZoomA,
                    scenario.minZoomB,
                    scenario.maxZoomB
                );
                const fixture = scenario.expectedLayers.length === 0
                    ? fixturePath('empty')
                    : fixturePath(`layers--${scenario.expectedLayers.join('-')}--z${scenario.z}`);
                var testClient = new TestClient(mapconfig);
                testClient.getTile(scenario.z, scenario.x, scenario.y, function (err, tile, img) {
                    assert.ifError(err);
                    assert.ok(tile);
                    assert.ok(img);
                    assert.imageEqualsFile(tile, fixture, IMAGE_TOLERANCE_PER_MIL, done);
                });
            });
        });
    });

    describe('vector tiles', function () {
        const layersValidator = (z, x, y, expectedLayers, done) => {
            return (err, mvtTile) => {
                assert.ifError(err);
                if (expectedLayers.length === 0) {
                    return done();
                }

                var vtile = new mapnik.VectorTile(0, 0, 0);
                vtile.setData(mvtTile);
                assert.equal(vtile.painted(), true);
                assert.equal(vtile.empty(), false);

                var result = vtile.toJSON();
                assert.equal(result.length, expectedLayers.length);

                expectedLayers.forEach((layerId, index) => {
                    var layer = result[index];
                    assert.equal(layer.name, layerId);
                    assert.equal(layer.features.length, 1);
                });

                done();
            };
        };

        const suiteConfigurations = [{ mvt: { usePostGIS: false } }, { mvt: { usePostGIS: true } }];

        suiteConfigurations.forEach(function (clientOptions) {
            describe(`${JSON.stringify(clientOptions)}`, function () {
                scenarios.forEach(function (scenario) {
                    it(scenario.desc, function (done) {
                        const mapconfig = getMapConfig(
                            scenario.minZoomA,
                            scenario.maxZoomA,
                            scenario.minZoomB,
                            scenario.maxZoomB
                        );
                        var testClient = new TestClient(mapconfig, clientOptions);
                        testClient.getTile(
                            scenario.z,
                            scenario.x,
                            scenario.y,
                            { format: 'mvt' },
                            layersValidator(scenario.z, scenario.x, scenario.y, scenario.expectedLayers, done)
                        );
                    });
                });
            });
        });
    });
});
