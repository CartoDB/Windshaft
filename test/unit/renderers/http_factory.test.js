var assert = require('assert');
var HttpRendererFactory = require('../../../lib/windshaft/renderers/http/factory');

suite('renderer_http_factory', function() {

    var validUrlTemplate = 'http://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';
    var anotherValidUrlTemplate = 'http://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png';

    var anySRegexUrlTemplate = 'http://(.*).basemaps.cartocdn.com/dark_all/(.*)/(.*)/(.*).png';
    var curlySRegexUrlTemplate = 'http://{(.)}.basemaps.cartocdn.com/light_nolabels/(.*)/(.*)/(.*).png';

    var invalidUrlTemplate = 'http://wadus.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';

    var whitelistSample = [
        validUrlTemplate,
        anotherValidUrlTemplate
    ];

    var regexWhitelistSample = [
        anySRegexUrlTemplate,
        curlySRegexUrlTemplate
    ];

    test('valid urlTemplate', function(done) {
        assert.equal(HttpRendererFactory.isValidUrlTemplate(validUrlTemplate, whitelistSample), true);
        done();
    });

    test('valid REGEX urlTemplate no curly braces', function(done) {
        assert.equal(HttpRendererFactory.isValidUrlTemplate(validUrlTemplate, regexWhitelistSample), true);
        done();
    });

    test('valid REGEX urlTemplate with curly brace match', function(done) {
        assert.equal(HttpRendererFactory.isValidUrlTemplate(anotherValidUrlTemplate, regexWhitelistSample), true);
        done();
    });

    test('invalid urlTemplate', function(done) {
        assert.equal(HttpRendererFactory.isValidUrlTemplate(invalidUrlTemplate, whitelistSample), false);
        done();
    });

    test.skip('invalid urlTemplate no curly braces', function(done) {
        assert.equal(HttpRendererFactory.isValidUrlTemplate(invalidUrlTemplate, regexWhitelistSample), false);
        done();
    });

    test('invalid urlTemplate with curly brace match', function(done) {
        assert.equal(HttpRendererFactory.isValidUrlTemplate(invalidUrlTemplate, [curlySRegexUrlTemplate]), false);
        done();
    });

    test('valid urlTemplate requiring input escape', function(done) {
        var urlTemplateRequiringEscape =
            'https://{s}.maps.nlp.nokia.com/maptile/2.1/maptile/newest/satellite.day/{z}/{x}/{y}/256/png8?lg=eng';
        assert.equal(
            HttpRendererFactory.isValidUrlTemplate(urlTemplateRequiringEscape, regexWhitelistSample.concat([urlTemplateRequiringEscape])),
            true
        );
        done();
    });

});
