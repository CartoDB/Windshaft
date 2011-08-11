var server = require('../server');
var assert = require('assert');
var _      = require('underscore');
var tests  = module.exports = {};

tests['true'] = function() {
  assert.ok(true);
}

test["get style returns a default style"] = function(){
  assert.response(server, {
      url: '/',
      method: 'GET'
  },{
      status: 200,
  });
};