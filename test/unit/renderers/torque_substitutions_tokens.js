require('../../support/test_helper');

var assert = require('assert');
var SubstitutionTokens = require('../../../lib/windshaft/renderers/torque/substitution_tokens');

describe('Torque substitution tokens', function() {

    var tokens = ['bbox', 'pixel_width', 'pixel_height', 'scale_denominator'];
    tokens.forEach(function(token) {
        it('replaces token: ' + token, function() {
            var replaceValues = {};
            replaceValues[token] = 'wadus';
            assert.equal(SubstitutionTokens.replace('!' + token + '!', replaceValues), replaceValues[token]);
        });
    });

    it('should not replace unsupported tokens', function() {
        var replaceValues = { unsupported: 'wadus' };
        assert.equal(SubstitutionTokens.replace('!unsupported!', replaceValues), '!unsupported!');
    });
});
