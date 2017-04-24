var assert = require('assert');
var MapConfig = require('../../../lib/windshaft/models/mapconfig');

describe('mapconfig buffer-size', function() {
    var CARTODB_LAYER = {
        type: 'cartodb',
        options: {
            sql: 'select 1 a, null::geometry the_geom',
            cartocss: '#layer{}',
            cartocss_version: '2.3.0',
            interactivity: ['a', 'b']
        }
    };

    it('should not have buffer-size defined', function() {
        var mapConfig = MapConfig.create({
            version: '1.6.0',
            layers: [
                CARTODB_LAYER
            ]
        });

        assert.equal(mapConfig.getBufferSize(), undefined);
    });


    it('should return generic buffer-size when no format is specified', function() {
        var mapConfig = MapConfig.create({
            version: '1.6.0',
            buffersize: 64,
            layers: [
                CARTODB_LAYER
            ]
        });

        assert.equal(mapConfig.getBufferSize(), 64);
    });

    it('should return buffer-size for png format', function() {
        var mapConfig = MapConfig.create({
            version: '1.6.0',
            buffersize: {
                png: 64
            },
            layers: [
                CARTODB_LAYER
            ]
        });

        assert.equal(mapConfig.getBufferSize('png'), 64);
    });

    it('should return buffer-size for any format when generic buffer-size is defined', function() {
        var mapConfig = MapConfig.create({
            version: '1.6.0',
            buffersize: 64,
            layers: [
                CARTODB_LAYER
            ]
        });

        assert.equal(mapConfig.getBufferSize('png'), 64);
        assert.equal(mapConfig.getBufferSize('mvt'), 64);
    });

    it('should not return buffer-size when just png is defined and another format is required', function() {
        var mapConfig = MapConfig.create({
            version: '1.6.0',
            buffersize: {
                png: 64
            },
            layers: [
                CARTODB_LAYER
            ]
        });

        assert.equal(mapConfig.getBufferSize('mvt'), undefined);
    });
});