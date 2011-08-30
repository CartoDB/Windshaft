var _      = require('underscore');
var assert      = require('assert');
var server      = require('../../lib/windshaft');
var tests       = module.exports = {};

tests['true'] = function() {
    assert.ok(true);
};