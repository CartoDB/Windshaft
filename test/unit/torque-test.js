'use strict';

require('../support/test-helper');

var assert = require('assert');
var TorqueFactory = require('../../lib/renderers/torque/factory');
var MapConfig = require('../../lib/models/mapconfig');
const PSQLAdaptor = require('../../lib/renderers/torque/psql-adaptor');

function mockPSQLAdaptorQuery ({ columnsQueryResult, stepQueryResult, tileQueryResult = {} }) {
    PSQLAdaptor.prototype.query = async function (sql) {
        if (sql.endsWith('__torque_wrap_sql limit 0')) {
            return columnsQueryResult;
        } else if (sql.startsWith('SELECT count(*) as num_steps')) {
            return stepQueryResult;
        } else {
            return tileQueryResult;
        }
    };
}

describe('torque', function () {
    var layergroupNoTorque = {
        layers: [
            {
                type: 'cartodb',
                options: {
                    sql: 'select * from table',
                    cartocss: ['#layer { marker-fill: #000; }'].join(''),
                    cartocss_version: '2.1.1'
                }
            }
        ]
    };
    var mapConfigNoTorque = MapConfig.create(layergroupNoTorque);

    function makeCartoCss (mapAttributes) {
        mapAttributes = mapAttributes || [
            '-torque-time-attribute: "date";',
            '-torque-aggregation-function: "count(cartodb_id)";',
            '-torque-frame-count: 760;',
            '-torque-animation-duration: 15;',
            '-torque-resolution: 2'
        ];
        return [
            'Map {',
            mapAttributes.join(' '),
            '}',
            '#layer {',
            'marker-width: 3;',
            '}'
        ].join('');
    }

    function layergroupConfig (cartocss) {
        cartocss = cartocss || makeCartoCss();
        return {
            layers: [
                {
                    type: 'torque',
                    options: {
                        sql: 'select * from table',
                        cartocss: cartocss,
                        cartocss_version: '2.1.1'
                    }
                }
            ]
        };
    }

    var mapConfig = MapConfig.create(layergroupConfig());

    var torque = null;

    beforeEach(function () {
        torque = new TorqueFactory();
        this.originalPSQLAdaptorQueryMethod = PSQLAdaptor.prototype.query;
    });

    afterEach(function () {
        PSQLAdaptor.prototype.query = this.originalPSQLAdaptorQueryMethod;
    });

    function rendererOptions (layer) {
        return {
            params: {
                dbname: 'windshaft_test'
            },
            layer: layer
        };
    }

    var layerZeroOptions = rendererOptions(0);

    describe('getRenderer', function () {
        it('should create a renderer with right parmas', function (done) {
            mockPSQLAdaptorQuery({
                columnsQueryResult: { fields: { date: { type: 'date' } } },
                stepQueryResult: {
                    rows: [
                        { min_date: 0, max_date: 10, num_steps: 1, xmin: 0, xmax: 10, ymin: 0, ymax: 10 }
                    ]
                }
            });
            torque.getRenderer(mapConfig, 'json.torque', layerZeroOptions, function (err, renderer) {
                assert.ifError(err);
                assert.ok(!!renderer);
                assert.ok(!!renderer.getTile);
                done();
            });
        });

        it('should raise an error on missing -torque-frame-count', function (done) {
            mockPSQLAdaptorQuery({
                columnsQueryResult: { fields: { date: { type: 'date' } } },
                stepQueryResult: {
                    rows: [
                        { min_date: 0, max_date: 10, num_steps: 1, xmin: 0, xmax: 10, ymin: 0, ymax: 10 }
                    ]
                }
            });
            var brokenConfig = MapConfig.create(layergroupConfig(makeCartoCss(
                [
                    '-torque-time-attribute: "date";',
                    '-torque-aggregation-function: "count(cartodb_id)";',
                    '-torque-animation-duration: 15;',
                    '-torque-resolution: 2'
                ]
            )));
            torque.getRenderer(brokenConfig, 'json.torque', layerZeroOptions, function (err/*, renderer */) {
                assert.ok(err !== null);
                assert.ok(err instanceof Error);
                assert.equal(err.message, "TorqueRenderer: Missing required property '-torque-frame-count' in torque layer CartoCSS");
                done();
            });
        });

        it('should raise an error on missing -torque-resolution', function (done) {
            mockPSQLAdaptorQuery({
                columnsQueryResult: { fields: { date: { type: 'date' } } },
                stepQueryResult: {
                    rows: [
                        { min_date: 0, max_date: 10, num_steps: 1, xmin: 0, xmax: 10, ymin: 0, ymax: 10 }
                    ]
                }
            });
            var brokenConfig = MapConfig.create(layergroupConfig(makeCartoCss(
                [
                    '-torque-time-attribute: "date";',
                    '-torque-aggregation-function: "count(cartodb_id)";',
                    '-torque-frame-count: 760;',
                    '-torque-animation-duration: 15;'
                ]
            )));
            torque.getRenderer(brokenConfig, 'json.torque', layerZeroOptions, function (err/*, renderer */) {
                assert.ok(err !== null);
                assert.ok(err instanceof Error);
                assert.equal(err.message, "TorqueRenderer: Missing required property '-torque-resolution' in torque layer CartoCSS");
                done();
            });
        });

        it('should raise an error on missing -torque-time-attribute', function (done) {
            mockPSQLAdaptorQuery({
                columnsQueryResult: { fields: { date: { type: 'date' } } },
                stepQueryResult: {
                    rows: [
                        { min_date: 0, max_date: 10, num_steps: 1, xmin: 0, xmax: 10, ymin: 0, ymax: 10 }
                    ]
                }
            });
            var brokenConfig = MapConfig.create(layergroupConfig(makeCartoCss(
                [
                    '-torque-aggregation-function: "count(cartodb_id)";',
                    '-torque-frame-count: 760;',
                    '-torque-animation-duration: 15;',
                    '-torque-resolution: 2'
                ]
            )));
            torque.getRenderer(brokenConfig, 'json.torque', layerZeroOptions, function (err/*, renderer */) {
                assert.ok(err !== null);
                assert.ok(err instanceof Error);
                assert.equal(err.message, "TorqueRenderer: Missing required property '-torque-time-attribute' in torque layer CartoCSS");
                done();
            });
        });

        it('should return error when format is unsuported', function (done) {
            torque.getRenderer(mapConfig, 'dummy', layerZeroOptions, function (err/*, renderer */) {
                assert.ok(err !== null);
                assert.ok(err instanceof Error);
                assert.equal(err.message, 'format not supported: dummy');
                done();
            });
        });

        it('should raise an error when layer is not set', function (done) {
            torque.getRenderer(mapConfigNoTorque, 'json.torque', { params: {} }, function (err/*, renderer */) {
                assert.ok(err !== null);
                assert.ok(err instanceof Error);
                assert.equal(err.message, 'torque renderer only supports a single layer');
                done();
            });
        });
        it('should raise an error when layer does not exist', function (done) {
            torque.getRenderer(mapConfig, 'json.torque', rendererOptions(1), function (err/*, renderer */) {
                assert.ok(err !== null);
                assert.ok(err instanceof Error);
                assert.equal(err.message, 'layer index is greater than number of layers');
                done();
            });
        });
    });

    describe('Renderer', function () {
        it('should get metadata', function (done) {
            mockPSQLAdaptorQuery({
                columnsQueryResult: { fields: { date: { type: 'date' } } },
                stepQueryResult: {
                    rows: [
                        { min_date: 0, max_date: 10, num_steps: 1, xmin: 0, xmax: 10, ymin: 0, ymax: 10 }
                    ]
                }
            });
            torque.getRenderer(mapConfig, 'json.torque', layerZeroOptions, function (err, renderer) {
                assert.ok(err === null);
                renderer.getMetadata()
                    .then(m => {
                        assert.equal(0, m.start);
                        assert.equal(10000, m.end);
                        assert.equal(1, m.data_steps);
                        assert.equal('date', m.column_type);
                        done();
                    })
                    .catch(err => done(err));
            });
        });
        it('should get a tile', function (done) {
            mockPSQLAdaptorQuery({
                columnsQueryResult: {
                    fields: { date: { type: 'date' } }
                },
                stepQueryResult: {
                    rows: [
                        { min_date: 0, max_date: 10, num_steps: 1, xmin: 0, xmax: 10, ymin: 0, ymax: 10 }
                    ]
                },
                tileQueryResult: {
                    rows: [
                        { x__uint8: 0, y__uint8: 0, vals__uint8: [0, 1, 2], dates__uint16: [4, 5, 6] }
                    ]
                }
            });

            torque.getRenderer(mapConfig, 'json.torque', layerZeroOptions, function (err, renderer) {
                assert.ifError(err);
                renderer.getTile('json.torque', 0, 0, 0)
                    .then(({ buffer: tile }) => {
                        assert.ok(!!tile);
                        assert.ok(tile[0].x__uint8 !== undefined);
                        assert.ok(tile[0].y__uint8 !== undefined);
                        assert.ok(tile[0].vals__uint8 !== undefined);
                        assert.ok(tile[0].dates__uint16 !== undefined);
                        done();
                    })
                    .catch((err) => done(err));
            });
        });

        it('should not get Infinity steps', function (done) {
            var layergroup = {
                layers: [
                    {
                        type: 'torque',
                        options: {
                            sql: 'select * from test_table LIMIT 0',
                            cartocss: [
                                'Map {' +
                                '-torque-frame-count:1;' +
                                '-torque-resolution:1;' +
                                "-torque-aggregation-function:'count(*)';" +
                                "-torque-time-attribute:'updated_at';" +
                            '}'
                            ].join('')
                        },
                        cartocss_version: '2.1.1'
                    }

                ]
            };
            var mapConfig = MapConfig.create(layergroup);

            mockPSQLAdaptorQuery({
                columnsQueryResult: { fields: { updated_at: { type: 'date' } } },
                stepQueryResult: { rows: [{ num_steps: 0, max_date: null, min_date: null }] }
            });

            torque.getRenderer(mapConfig, 'json.torque', layerZeroOptions, function (err, renderer) {
                assert.ifError(err);
                assert.equal(renderer.attrs.step, 1, 'Number of steps cannot be Infinity');
                done();
            });
        });
    });
});
