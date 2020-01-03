'use strict';

require('../support/test-helper.js');

var assert = require('assert');
var MapConfig = require('../../lib/models/mapconfig');

describe('mapconfig', function () {
    it('can not create mapconfig with invalid version', function (done) {
        var version = '0.1.0';
        assert.throws(
            function () {
                MapConfig.create({
                    version: version
                });
            },
            function (err) {
                assert.equal(err.message, 'Unsupported layergroup configuration version ' + version);
                done();
                return true;
            }
        );
    });

    it('can not create mapconfig with no options in layer', function (done) {
        assert.throws(
            function () {
                MapConfig.create({
                    version: '1.3.0',
                    layers: [
                        {
                            type: 'mapnik'
                        }
                    ]
                });
            },
            function (err) {
                assert.equal(err.message, 'Missing options from layer 0 of layergroup config');
                done();
                return true;
            }
        );
    });

    it('interactivity array gets converted into comma joined string', function (done) {
        var mapConfig = MapConfig.create({
            version: '1.3.0',
            layers: [
                {
                    type: 'mapnik',
                    options: {
                        sql: 'select 1 a, 2 b, null::geometry the_geom',
                        cartocss: '#layer{}',
                        cartocss_version: '2.3.0',
                        interactivity: ['a', 'b']
                    }
                }
            ]
        });

        var layer = mapConfig.getLayer(0);
        assert.equal(layer.options.interactivity, 'a,b');
        done();
    });

    it('interactivity array gets converted into comma joined string', function (done) {
        var mapConfig = MapConfig.create({
            version: '1.3.0',
            layers: [
                {
                    type: 'mapnik',
                    options: {
                        sql: 'select 1 a, 2 b, null::geometry the_geom',
                        cartocss: '#layer{}',
                        cartocss_version: '2.3.0',
                        interactivity: ['a', 'b']
                    }
                }
            ]
        });

        var layer = mapConfig.getLayer(0);
        assert.equal(layer.options.interactivity, 'a,b');
        done();
    });

    it('.getLayerId() shoud return an id for the given layer', function () {
        var rawMapConfig = {
            version: '1.3.0',
            layers: [
                {
                    type: 'mapnik',
                    options: {
                        sql: 'select 1 a, 2 b, null::geometry the_geom',
                        cartocss: '#layer{}',
                        cartocss_version: '2.3.0'
                    }
                }
            ]
        };

        var layerId = MapConfig.getLayerId(rawMapConfig, 0);
        assert.equal(layerId, 'layer0');
    });

    it('.getLayerId() shoud return an id for the given layer with id', function () {
        var rawMapConfig = {
            version: '1.3.0',
            layers: [{
                id: 'test-name',
                type: 'mapnik',
                options: {
                    sql: 'select 1 a, 2 b, null::geometry the_geom',
                    cartocss: '#layer{}',
                    cartocss_version: '2.3.0'
                }
            }]
        };

        var layerId = MapConfig.getLayerId(rawMapConfig, 0);
        assert.equal(layerId, 'test-name');
    });

    it('.getLayerOption() shoud return an option for the given layer and option name', function () {
        var mapConfig = MapConfig.create({
            version: '1.3.0',
            layers: [{
                id: 'test-name',
                type: 'mapnik',
                options: {
                    sql: 'select 1 a, 2 b, null::geometry the_geom',
                    cartocss: '#layer{}',
                    cartocss_version: '2.3.0'
                }
            }]
        });

        var sql = mapConfig.getLayerOption(0, 'sql');
        assert.equal(sql, 'select 1 a, 2 b, null::geometry the_geom');
    });

    it('.getLayerOption() with default value provided should return it when option does not exist', function () {
        var mapConfig = MapConfig.create({
            version: '1.3.0',
            layers: [{
                id: 'test-name',
                type: 'mapnik',
                options: {
                    sql: 'select 1 a, 2 b, null::geometry the_geom',
                    cartocss: '#layer{}',
                    cartocss_version: '2.3.0'
                }
            }]
        });

        var srid = mapConfig.getLayerOption(0, 'srid', 4326);
        assert.equal(srid, 4326);
    });

    it('.getLayerDatasource() should return datasource', function () {
        var mapConfig = MapConfig.create({
            cfg: {
                version: '1.3.0',
                layers: [{
                    id: 'test-name',
                    type: 'mapnik',
                    options: {
                        sql: 'select 1 a, 2 b, null::geometry the_geom',
                        cartocss: '#layer{}',
                        cartocss_version: '2.3.0'
                    }
                }]
            },
            ds: [{
                user: 'wadus',
                port: 1234
            }]
        });

        var ds = mapConfig.getLayerDatasource(0);
        assert.deepEqual(ds, {
            user: 'wadus',
            port: 1234
        });
    });

    it('.getLayerDatasource() with wrong index should return empty object', function () {
        var mapConfig = MapConfig.create({
            cfg: {
                version: '1.3.0',
                layers: [{
                    id: 'test-name',
                    type: 'mapnik',
                    options: {
                        sql: 'select 1 a, 2 b, null::geometry the_geom',
                        cartocss: '#layer{}',
                        cartocss_version: '2.3.0'
                    }
                }]
            },
            ds: [{
                user: 'wadus',
                port: 1234
            }]
        });

        var ds = mapConfig.getLayerDatasource(1);
        assert.deepEqual(ds, {});
    });

    it('.getLayerDatasource() should return datasource with srid', function () {
        var mapConfig = MapConfig.create({
            cfg: {
                version: '1.3.0',
                layers: [{
                    id: 'test-name',
                    type: 'mapnik',
                    options: {
                        sql: 'select 1 a, 2 b, null::geometry the_geom',
                        cartocss: '#layer{}',
                        cartocss_version: '2.3.0',
                        srid: 3857
                    }
                }]
            },
            ds: [{
                user: 'wadus',
                port: 1234
            }]
        });

        var ds = mapConfig.getLayerDatasource(0);
        assert.deepEqual(ds, {
            user: 'wadus',
            port: 1234,
            srid: 3857
        });
    });
});
