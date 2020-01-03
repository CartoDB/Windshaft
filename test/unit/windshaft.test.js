'use strict';

require('../support/test_helper.js');

var assert = require('assert');
var windshaft = require('../../lib/windshaft');

describe('windshaft', function () {
    it('should have valid global environment', function () {
        assert.equal(global.environment.name, 'test');
    });

    it('should expose version numbers', function () {
        assert.ok(Object.prototype.hasOwnProperty.call(windshaft, 'version'), "No 'windshaft' version in " + windshaft);

        var versions = windshaft.versions;
        assert.ok(Object.prototype.hasOwnProperty.call(versions, 'windshaft'), "No 'windshaft' version in " + versions);
        assert.ok(Object.prototype.hasOwnProperty.call(versions, 'grainstore'), "No 'grainstore' version in " + versions);
        assert.ok(Object.prototype.hasOwnProperty.call(versions, 'node_mapnik'), "No 'node_mapnik' version in " + versions);
        assert.ok(Object.prototype.hasOwnProperty.call(versions, 'mapnik'), "No 'mapnik' version in " + versions);
    });
});
