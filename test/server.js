var server = require('../server');
var assert = require('assert');
var _      = require('underscore');
var tests  = module.exports = {};

tests['true'] = function() {
  assert.ok(true);
}
