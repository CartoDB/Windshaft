'use strict';

var assert = require('assert');
var CartocssParser = require('../../../lib/windshaft/utils/cartocss-parser');
var carto = require('carto');
var torque_reference = require('torque.js').cartocss_reference;

describe.skip('cartocss parser', function () {
    beforeEach(function () {
        this.cartocssParser = new CartocssParser();
    });

    describe('.getColumnNamesFromCartoCSS()', function () {

        it('from "text-name: [name]" should return ["name"]', function () {
            var cartocss = [
                '#layer {',
                ' width: [property];',
                ' marker-fill: [property2];',
                '}'
            ].join('\n');

            carto.tree.Reference.setData(torque_reference.version.latest);

            var env = {
                benchmark: false,
                validation_data: false,
                effects: [],
                errors: [],
                error: function(e) {
                  this.errors.push(e);
                }
            };

            var root = (carto.Parser(env)).parse(cartocss);
            console.log(root.rules[0].rules[0].value.value[0]);
            console.log(root.rules[0].rules[1].value.value[0]);
        });

    });
});
