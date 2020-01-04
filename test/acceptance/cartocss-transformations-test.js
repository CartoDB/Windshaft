'use strict';

require('../support/test-helper');

var assert = require('../support/assert');
var TestClient = require('../support/test-client');
const environment = require('../support/environment');

var IMAGE_EQUALS_TOLERANCE_PER_MIL = 20;

describe('cartocss transformation', function () {
    var pointsQuery = [
        'SELECT',
        '    row_number() OVER (ORDER BY x DESC) AS cartodb_id,',
        '    st_setsrid(st_makepoint(20 * x, 20 * x), 4326) as the_geom,',
        '    st_transform(st_setsrid(st_makepoint(20 * x, 20 * x), 4326), 3857) as the_geom_webmercator',
        'FROM generate_series(-3, 3) x'
    ].join('\n');

    var polygonsQuery = [
        'SELECT',
        '    row_number() OVER (ORDER BY x DESC) AS cartodb_id,',
        '    st_envelope(st_buffer(st_setsrid(st_makepoint(20*x, 20*x), 4326), 10000000)) as the_geom,',
        '    st_envelope(',
        '       st_buffer(st_transform(st_setsrid(st_makepoint(20*x, 20*x), 4326), 3857), 10000000)',
        '    ) as the_geom_webmercator',
        'FROM generate_series(1, 1) x'
    ].join('\n');

    var scenariosMapnik3 = [{
        description: 'should accept cartocss 3.0.12 for points using mapnik 3.0.12',
        sql: pointsQuery,
        cartocss: [
            '#layer {',
            '  marker-fill: #FF6600;',
            '}'
        ].join('\n'),
        cartocssVersion: '3.0.12',
        fixture: './test/fixtures/seven_orange_points.png',
        mapnikVersion: '3.0.12'
    }, {
        description: 'should accept cartocss 2.3.0 for points using mapnik 3.0.12',
        sql: pointsQuery,
        cartocss: [
            '#layer {',
            '  marker-fill: #FF6600;',
            '}'
        ].join('\n'),
        cartocssVersion: '2.3.0',
        fixture: './test/fixtures/seven_orange_points.png',
        mapnikVersion: '3.0.12'
    }, {
        description: 'should accept cartocss 2.1.0 for points using mapnik 3.0.12',
        sql: pointsQuery,
        cartocss: [
            '#layer {',
            '  marker-fill: #FF6600;',
            '}'
        ].join('\n'),
        cartocssVersion: '2.1.0',
        fixture: './test/fixtures/seven_orange_points.png',
        mapnikVersion: '3.0.12'
    }, {
        description: 'should accept cartocss 2.0.0 for points using mapnik 3.0.12',
        sql: pointsQuery,
        cartocss: [
            '#layer {',
            '  marker-fill: #FF6600;',
            '}'
        ].join('\n'),
        cartocssVersion: '2.0.0',
        fixture: './test/fixtures/seven_orange_points.png',
        mapnikVersion: '3.0.12'
    }, {
        description: 'should accept cartocss 3.0.12 for polygons using mapnik 3.0.12',
        sql: polygonsQuery,
        cartocss: [
            '#layer {',
            '   polygon-fill: rgba(128,128,128,1);',
            '   line-color: rgba(0,0,0,1);',
            '}'
        ].join('\n'),
        cartocssVersion: '3.0.12',
        fixture: './test/fixtures/one_grey_square.png',
        mapnikVersion: '3.0.12'
    }, {
        description: 'should accept cartocss 2.3.0 for polygons using mapnik 3.0.12',
        sql: polygonsQuery,
        cartocss: [
            '#layer {',
            '   polygon-fill: rgba(128,128,128,1);',
            '   line-color: rgba(0,0,0,1);',
            '}'
        ].join('\n'),
        cartocssVersion: '2.3.0',
        fixture: './test/fixtures/one_grey_square.png',
        mapnikVersion: '3.0.12'
    }, {
        description: 'should accept cartocss 2.1.0 for polygons using mapnik 3.0.12',
        sql: polygonsQuery,
        cartocss: [
            '#layer {',
            '   polygon-fill: rgba(128,128,128,1);',
            '   line-color: rgba(0,0,0,1);',
            '}'
        ].join('\n'),
        cartocssVersion: '2.1.0',
        fixture: './test/fixtures/one_grey_square.png',
        mapnikVersion: '3.0.12'
    }, {
        description: 'should accept cartocss 2.0.0 for polygons using mapnik 3.0.12',
        sql: polygonsQuery,
        cartocss: [
            '#layer {',
            '   polygon-fill: rgba(128,128,128,1);',
            '   line-color: rgba(0,0,0,1);',
            '}'
        ].join('\n'),
        cartocssVersion: '2.0.0',
        fixture: './test/fixtures/one_grey_square.png',
        mapnikVersion: '3.0.12'
    }];

    var scenariosMapnik2 = [{
        description: 'should accept cartocss 2.3.0 for points using mapnik 2.3.0',
        sql: pointsQuery,
        cartocss: [
            '#layer {',
            '  marker-fill: #FF6600;',
            '}'
        ].join('\n'),
        cartocssVersion: '2.3.0',
        fixture: './test/fixtures/seven_orange_points.png',
        mapnikVersion: '2.3.0'
    }, {
        description: 'should accept cartocss 2.1.0 for points using mapnik 2.3.0',
        sql: pointsQuery,
        cartocss: [
            '#layer {',
            '  marker-fill: #FF6600;',
            '}'
        ].join('\n'),
        cartocssVersion: '2.1.0',
        fixture: './test/fixtures/seven_orange_points.png',
        mapnikVersion: '2.3.0'
    }, {
        description: 'should accept cartocss 2.0.0 for points using mapnik 2.3.0',
        sql: pointsQuery,
        cartocss: [
            '#layer {',
            '  marker-fill: #FF6600;',
            '}'
        ].join('\n'),
        cartocssVersion: '2.0.0',
        fixture: './test/fixtures/seven_orange_points.png',
        mapnikVersion: '2.3.0'
    }, {
        description: 'should accept cartocss 2.3.0 for polygons using mapnik 2.3.0',
        sql: polygonsQuery,
        cartocss: [
            '#layer {',
            '   polygon-fill: rgba(128,128,128,1);',
            '   line-color: rgba(0,0,0,1);',
            '}'
        ].join('\n'),
        cartocssVersion: '2.3.0',
        fixture: './test/fixtures/one_grey_square.png',
        mapnikVersion: '2.3.0'
    }, {
        description: 'should accept cartocss 2.1.0 for polygons using mapnik 2.3.0',
        sql: polygonsQuery,
        cartocss: [
            '#layer {',
            '   polygon-fill: rgba(128,128,128,1);',
            '   line-color: rgba(0,0,0,1);',
            '}'
        ].join('\n'),
        cartocssVersion: '2.1.0',
        fixture: './test/fixtures/one_grey_square.png',
        mapnikVersion: '2.3.0'
    }, {
        description: 'should accept cartocss 2.0.0 for polygons using mapnik 2.3.0',
        sql: polygonsQuery,
        cartocss: [
            '#layer {',
            '   polygon-fill: rgba(128,128,128,1);',
            '   line-color: rgba(0,0,0,1);',
            '}'
        ].join('\n'),
        cartocssVersion: '2.0.0',
        fixture: './test/fixtures/one_grey_square.png',
        mapnikVersion: '2.3.0'
    }];

    var scenarios = scenariosMapnik3.concat(scenariosMapnik2);

    scenarios.forEach(function (scenario) {
        it(scenario.description, function (done) {
            var mapConfig = TestClient.singleLayerMapConfig(scenario.sql, scenario.cartocss, scenario.cartocssVersion);
            var options = {
                mapnik: {
                    grainstore: Object.assign(
                        {},
                        environment.renderer.mapnik.grainstore,
                        { mapnik_version: scenario.mapnikVersion }
                    )
                }
            };

            var testClient = new TestClient(mapConfig, options);

            testClient.getTile(0, 0, 0, function (err, tile) {
                assert.ifError(err);

                assert.imageEqualsFile(
                    tile,
                    scenario.fixture,
                    IMAGE_EQUALS_TOLERANCE_PER_MIL,
                    done
                );
            });
        });
    });

    var errorScenarios = [{
        description: 'should throw error no CartoCSS (3.0.12) transform path using mapnik 2.3.0',
        sql: pointsQuery,
        cartocss: [
            '#layer {',
            '  marker-fill: #FF6600;',
            '}'
        ].join('\n'),
        cartocssVersion: '3.0.12',
        fixture: './test/fixtures/seven_orange_points.png',
        mapnikVersion: '2.3.0'
    }];

    errorScenarios.forEach(function (scenario) {
        it(scenario.description, function (done) {
            var mapConfig = TestClient.singleLayerMapConfig(scenario.sql, scenario.cartocss, scenario.cartocssVersion);
            var options = {
                mapnik: {
                    grainstore: Object.assign(
                        {},
                        environment.renderer.mapnik.grainstore,
                        { mapnik_version: scenario.mapnikVersion }
                    )
                }
            };

            var testClient = new TestClient(mapConfig, options);

            testClient.getTile(0, 0, 0, function (err) {
                assert.ok(err);
                assert.equal(err.message, 'No CartoCSS transform path from 3.0.12 to 2.3.0');
                done();
            });
        });
    });
});
