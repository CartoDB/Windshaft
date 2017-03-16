require('../support/test_helper.js');

var assert = require('assert');
var windshaft = require('../../lib/windshaft');

describe('windshaft', function() {

    it('should have valid global environment',  function() {
        assert.equal(global.environment.name, 'test');
    });

    it('should expose version numbers', function() {
        assert.ok(windshaft.hasOwnProperty('version'), "No 'windshaft' version in " + windshaft);

        var versions = windshaft.versions;
        assert.ok(versions.hasOwnProperty('windshaft'), "No 'windshaft' version in " + versions);
        assert.ok(versions.hasOwnProperty('grainstore'), "No 'grainstore' version in " + versions);
        assert.ok(versions.hasOwnProperty('node_mapnik'), "No 'node_mapnik' version in " + versions);
        assert.ok(versions.hasOwnProperty('mapnik'), "No 'mapnik' version in " + versions);
    });

});
