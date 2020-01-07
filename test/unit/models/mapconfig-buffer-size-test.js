'use strict';

var assert = require('assert');
var MapConfig = require('../../../lib/models/mapconfig');

describe('mapconfig buffer-size', function () {
    var CARTODB_LAYER = {
        type: 'cartodb',
        options: {
            sql: 'select 1 a, null::geometry the_geom',
            cartocss: '#layer{}',
            cartocss_version: '2.3.0',
            interactivity: ['a', 'b']
        }
    };

    it('should not have buffer-size defined', function () {
        var mapConfig = MapConfig.create({
            version: '1.6.0',
            layers: [
                CARTODB_LAYER
            ]
        });

        assert.equal(mapConfig.getBufferSize(), undefined);
    });

    it('should return buffer-size for png, mvt and grid.json formats', function () {
        var mapConfig = MapConfig.create({
            version: '1.6.0',
            buffersize: {
                png: 64,
                mvt: 0,
                'grid.json': 128
            },
            layers: [
                CARTODB_LAYER
            ]
        });

        assert.equal(mapConfig.getBufferSize('png'), 64);
        assert.equal(mapConfig.getBufferSize('mvt'), 0);
        assert.equal(mapConfig.getBufferSize('grid.json'), 128);
    });

    it('should not return buffer-size when just png is defined and another format is required', function () {
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
