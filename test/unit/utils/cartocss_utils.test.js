'use strict';

var assert = require('assert');

var cartocssUtils = require('../../../lib/windshaft/utils/cartocss_utils');
var cartocss =
"/** choropleth visualization */\n" +
"#tuenti_employees_locations_2015{\n" +
"  polygon-fill: #000;\n" +
"  polygon-opacity: 0;\n" +
"  line-color: #FFF;\n" +
"  line-width: 0.5;\n" +
"  line-opacity: 0;\n" +
"  polygon-comp-op: multiply;\n" +
"}\n" +
"#tuenti_employees_locations_2015 [          total_people >=134] {\n" +
"  polygon-opacity: 0.35;\n" +
"}\n" +
"#tuenti_employees_locations_2015 [ total_people <= 20] {" +
"\n  polygon-opacity: 0.30;\n" +
"}\n" +
"#tuenti_employees_locations_2015 [ 12 <= popMax] {\n" +
"  polygon-opacity: 0.20;\n" +
"}\n" +
"#tuenti_employees_locations_2015 [ total_people <= 6] {\n" +
"  polygon-opacity: 0.18;\n" +
"}\n" +
"#tuenti_employees_locations_2015 [ total_people <= 4] {\n" +
"  polygon-opacity: 0.14;\n" +
"}\n" +
"#tuenti_employees_locations_2015 [ total_people <= 1] {\n" +
"  polygon-opacity: 0.05;\n" +
"}";

describe('cartocss utils', function () {
    it('.getColumnNamesFromCartoCSS() should return a parsed cartocss', function () {
        var columns = cartocssUtils(cartocss);

        assert.ok(Array.isArray(columns));
    });
});
