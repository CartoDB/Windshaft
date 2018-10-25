'use strict';

require('../../support/test_helper.js');

const assert = require('assert');
const MapConfig = require('../../../lib/windshaft/models/mapconfig');

describe('Map Config model', function () {
    function createMapConfigRaw (buffersize) {
        return {
            version: '1.7.0',
            buffersize,
            layers: [{
                type: 'mapnik',
                options: {
                    sql: 'select * from test_table limit 1'
                }
            }]
        };
    }

    it('should throw "Buffer size must be a number" when buffersize "mvt" is equal to "1"', function () {
        let mapConfig;
        try {
            mapConfig = new MapConfig(createMapConfigRaw({ mvt: '1' }));
            throw new Error('Map config constructor didn\'t throw any error');
        } catch (err) {
            assert.equal(mapConfig, undefined);
            assert.equal(err.message, 'Buffer size of format "mvt" must be a number');
        }
    });

    it('should throw "Buffer size must be a number" when buffersize "mvt" is equal to ""', function () {
        let mapConfig;
        try {
            mapConfig = new MapConfig(createMapConfigRaw({ mvt: '' }));
            throw new Error('Map config constructor didn\'t throw any error');
        } catch (err) {
            assert.equal(mapConfig, undefined);
            assert.equal(err.message, 'Buffer size of format "mvt" must be a number');
        }
    });

    it('should throw "Buffer size must be a number" when buffersize "mvt" is equal to "invalid"', function () {
        let mapConfig;
        try {
            mapConfig = new MapConfig(createMapConfigRaw({ mvt: 'invalid' }));
            throw new Error('Map config constructor didn\'t throw any error');
        } catch (err) {
            assert.equal(mapConfig, undefined);
            assert.equal(err.message, 'Buffer size of format "mvt" must be a number');
        }
    });

    it('should not throw "Buffer size must be a number" when buffersize "mvt" is equal to undefined', function () {
        let mapConfig;
        try {
            mapConfig = new MapConfig(createMapConfigRaw({ mvt: undefined }));
            assert.notEqual(mapConfig, undefined);
        } catch (err) {
            throw new Error('Map config constructor threw:', err);
        }
    });

    it('should throw "Buffer size must be a number" when buffersize "mvt" is equal to "1e10"', function () {
        let mapConfig;
        try {
            mapConfig = new MapConfig(createMapConfigRaw({
                png: 64,
                mvt: '1e10'
            }));
            throw new Error('Map config constructor didn\'t throw any error');
        } catch (err) {
            assert.equal(mapConfig, undefined);
            assert.equal(err.message, 'Buffer size of format "mvt" must be a number');
        }
    });
});
