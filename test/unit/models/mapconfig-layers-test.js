'use strict';

// require('../support/test-helper.js');

var assert = require('assert');
var MapConfig = require('../../../lib/windshaft/models/mapconfig');

describe('mapconfig-layer-indexes', function () {
    var HTTP_LAYER = {
        type: 'http',
        options: {
            urlTemplate: 'http://127.0.0.1:8033/{z}/{x}/{y}.png'
        }
    };

    var NO_TYPE_LAYER = {
        type: 'cartodb',
        options: {
            sql: 'select 1 a, null::geometry the_geom',
            cartocss: '#layer{}',
            cartocss_version: '2.3.0',
            interactivity: ['a', 'b']
        }
    };

    var CARTODB_LAYER = {
        type: 'cartodb',
        options: {
            sql: 'select 1 a, null::geometry the_geom',
            cartocss: '#layer{}',
            cartocss_version: '2.3.0',
            interactivity: ['a', 'b']
        }
    };

    var MAPNIK_LAYER = {
        type: 'mapnik',
        options: {
            sql: 'select 1 a, null::geometry the_geom',
            cartocss: '#layer{}',
            cartocss_version: '2.3.0',
            interactivity: ['a', 'b']
        }
    };

    function mapnikBasicLayerId (index) {
        return 'layer' + index;
    }
    function typeLayerId (type, index) {
        return type + '-' + mapnikBasicLayerId(index);
    }

    var WADUS_ID = 'wadus';
    var MAPNIK_WADUS_ID_LAYER = {
        type: 'mapnik',
        id: WADUS_ID,
        options: {
            sql: 'select 1 a, null::geometry the_geom',
            cartocss: '#layer{}',
            cartocss_version: '2.3.0',
            interactivity: ['a', 'b']
        }
    };

    var TORQUE_LAYER = {
        type: 'torque',
        options: {
            sql: "select 1 as id, '1970-01-02'::date as d, 'POINT(0 0)'::geometry as the_geom",
            cartocss: ['Map {',
                '-torque-frame-count: 2;',
                '-torque-resolution: 3;',
                '-torque-time-attribute:d;',
                '-torque-aggregation-function: \'count(id)\';',
                '}'].join('\n'),
            cartocss_version: '2.0.1'
        }
    };

    it('uses layer{index} notation for happy case', function () {
        var mapConfig = MapConfig.create({
            version: '1.5.0',
            layers: [
                MAPNIK_LAYER
            ]
        });

        assert.equal(mapConfig.getLayerId(0), 'layer0');
    });

    it('uses id from layer', function () {
        var mapConfig = MapConfig.create({
            version: '1.5.0',
            layers: [
                MAPNIK_WADUS_ID_LAYER
            ]
        });

        assert.equal(mapConfig.getLayerId(0), WADUS_ID);
    });

    it('uses layer0 for mapnik layer even if it is not at index 0', function () {
        var mapConfig = MapConfig.create({
            version: '1.5.0',
            layers: [
                HTTP_LAYER, MAPNIK_LAYER
            ]
        });

        assert.equal(mapConfig.getLayerId(0), typeLayerId('http', 0));
        assert.equal(mapConfig.getLayerId(1), mapnikBasicLayerId(0));
    });

    it('uses layer{index} with type prepended when no mapnik layers', function () {
        var mapConfig = MapConfig.create({
            version: '1.5.0',
            layers: [
                HTTP_LAYER, MAPNIK_LAYER, MAPNIK_LAYER, NO_TYPE_LAYER, TORQUE_LAYER, CARTODB_LAYER
            ]
        });

        assert.equal(mapConfig.getLayerId(0), typeLayerId('http', 0));
        assert.equal(mapConfig.getLayerId(1), mapnikBasicLayerId(0));
        assert.equal(mapConfig.getLayerId(2), mapnikBasicLayerId(1));
        assert.equal(mapConfig.getLayerId(3), mapnikBasicLayerId(2));
        assert.equal(mapConfig.getLayerId(4), typeLayerId('torque', 0));
        assert.equal(mapConfig.getLayerId(5), mapnikBasicLayerId(3));
    });
});
