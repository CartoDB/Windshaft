'use strict';

var assert = require('assert');
var cartocssUtils = require('../../../lib/windshaft/utils/cartocss_utils');

describe('cartocss utils', function () {
    describe('.getColumnNamesFromCartoCSS()', function () {

        it('from "text-name: [name]" should return ["name"]', function () {
            var cartocss =
            "#cities {\n" +
            "  text-name: [name];\n" +
            "}";

            var columns = cartocssUtils.getColumnNamesFromCartoCSS(cartocss);
            assert.deepEqual(columns, [ 'name']);
        });

        it('from "#cities[1000>population]" should return ["population"]', function () {
            var cartocss =
            "#cities[population>1000] {\n" +
            "  text-face-name: 'Open Sans Regular';\n" +
            "}";

            var columns = cartocssUtils.getColumnNamesFromCartoCSS(cartocss);
            assert.deepEqual(columns, [ 'population']);
        });

        it('from "#cities[1000<population]" should return ["population"]', function () {
            var cartocss =
            "#cities[population<1000] {\n" +
            "  text-face-name: 'Open Sans Regular';\n" +
            "}";

            var columns = cartocssUtils.getColumnNamesFromCartoCSS(cartocss);
            assert.deepEqual(columns, [ 'population']);
        });

        it('from "#cities[1000>=population]" should return ["population"]', function () {
            var cartocss =
            "#cities[population>=1000] {\n" +
            "  text-face-name: 'Open Sans Regular';\n" +
            "}";

            var columns = cartocssUtils.getColumnNamesFromCartoCSS(cartocss);
            assert.deepEqual(columns, [ 'population']);
        });

        it('from "#cities[1000<=population]" should return ["population"]', function () {
            var cartocss =
            "#cities[population<=1000] {\n" +
            "  text-face-name: 'Open Sans Regular';\n" +
            "}";

            var columns = cartocssUtils.getColumnNamesFromCartoCSS(cartocss);
            assert.deepEqual(columns, [ 'population']);
        });

        it('from "#cities[1000=population]" should return ["population"]', function () {
            var cartocss =
            "#cities[population=1000] {\n" +
            "  text-face-name: 'Open Sans Regular';\n" +
            "}";

            var columns = cartocssUtils.getColumnNamesFromCartoCSS(cartocss);
            assert.deepEqual(columns, [ 'population']);
        });

        it('from "#cities[1000!=population]" should return ["population"]', function () {
            var cartocss =
            "#cities[population!=1000] {\n" +
            "  text-face-name: 'Open Sans Regular';\n" +
            "}";

            var columns = cartocssUtils.getColumnNamesFromCartoCSS(cartocss);
            assert.deepEqual(columns, [ 'population']);
        });

        it('from "#cities[1000>population]" should return ["population"]', function () {
            var cartocss =
            "#cities[1000>population] {\n" +
            "  text-face-name: 'Open Sans Regular';\n" +
            "}";

            var columns = cartocssUtils.getColumnNamesFromCartoCSS(cartocss);
            assert.deepEqual(columns, [ 'population']);
        });

        it('from cartocss with multiple expressions should return ["population", "name"]', function () {
            var cartocss =
            "#cities[population>1000000] {\n" +
            "  text-name: [name];\n" +
            "  text-face-name: 'Open Sans Regular';\n" +
            "}";

            var columns = cartocssUtils.getColumnNamesFromCartoCSS(cartocss);
            assert.deepEqual(columns, [ 'population', 'name']);
        });

        it('from cartocss with multiple and repeated expressions should return ["population", "name"]', function () {
            var cartocss =
            "#cities[population>1000000] {\n" +
            "  text-name: [name];\n" +
            "}\n" +
            "#cities[population>100000] {\n" +
            "  text-name: [name];\n" +
            "}";

            var columns = cartocssUtils.getColumnNamesFromCartoCSS(cartocss);
            assert.deepEqual(columns, [ 'population', 'name']);
        });

        it('from cartocss with multiple variables should return ["name"]', function () {
            var cartocss =
            "#cities {\n" +
            "  text-name: [name];\n" +
            "  shield-name: [name_en];\n" +
            "}";

            var columns = cartocssUtils.getColumnNamesFromCartoCSS(cartocss);
            assert.deepEqual(columns, [ 'name', 'name_en']);
        });

        it('from "cities[class=\'metropolis\']" (attribute selector) should return [] (empty array)', function () {
            var cartocss =
            "#cities[class='metropolis']{\n" +
            "  text-name: 'irrelevant';\n" +
            "}";

            var columns = cartocssUtils.getColumnNamesFromCartoCSS(cartocss);
            assert.deepEqual(columns, []);
        });

        it('from "#layer[zoom>=4][zoom<=10] {" should return ["zoom"]', function () {
            var cartocss =
            "#layer[zoom>=4][zoom<=10] {\n" +
            "  line-color: red;\n" +
            "}\n";

            var columns = cartocssUtils.getColumnNamesFromCartoCSS(cartocss);
            assert.deepEqual(columns, [ 'zoom']);
        });

        it('from "[zoom=8] { line-width: 3; }" should return ["zoom"]', function () {
            var cartocss =
            "#layer {\n" +
            "  [zoom=8] { line-width: 3; }\n" +
            "}\n";

            var columns = cartocssUtils.getColumnNamesFromCartoCSS(cartocss);
            assert.deepEqual(columns, [ 'zoom']);
        });

        it('from "[zoom>=4][population>1000000]" should return ["zoom"]', function () {
            var cartocss =
            "#cities {\n" +
            "  [zoom>=4][population>1000000]{\n" +
            "    text-face-name: 'Open Sans Regular';\n" +
            "  }\n" +
            "}\n";

            var columns = cartocssUtils.getColumnNamesFromCartoCSS(cartocss);
            assert.deepEqual(columns, ['zoom', 'population']);
        });

        it('from cartocss with multiple numeric filters should return ["zoom", "population", "name"]', function () {
            var cartocss =
            "#cities {\n" +
            "  [zoom>=4][population>1000000],\n" +
            "  [zoom>=5][population>500000],\n" +
            "  [zoom>=6][population>100000] {\n" +
            "    text-name: [name];\n" +
            "    text-face-name: 'Open Sans Regular'\n" +
            "  }\n" +
            "}";

            var columns = cartocssUtils.getColumnNamesFromCartoCSS(cartocss);
            assert.deepEqual(columns, ['zoom', 'population', 'name']);
        });

        it('from "#cities[address=~\'.*14th Street N.*\']{" should return ["address"]', function () {
            var cartocss =
            "#cities[address=~'.*14th Street N.*']{\n" +
            "  text-name: 'irrelevant';\n" +
            "}";

            var columns = cartocssUtils.getColumnNamesFromCartoCSS(cartocss);
            assert.deepEqual(columns, ['address']);
        });

    });
});
