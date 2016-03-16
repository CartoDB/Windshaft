'use strict';

var assert = require('assert');
var cartocssUtils = require('../../../lib/windshaft/utils/cartocss_utils');

describe('cartocss utils', function () {
    describe('.getColumnNamesFromCartoCSS()', function () {

        var testScenarios = [
            {
                cartocss: [
                    '#cities {',
                    '  polygon-fill: red;',
                    '}'
                ].join('\n'),
                expectedColumns: []
            },
            {
                cartocss: [
                    '#cities {',
                    '  text-name: [name];',
                    '}'
                ].join('\n'),
                expectedColumns: ['name']
            },
            {
                cartocss: [
                    '#cities[population>1000] {',
                    '  text-face-name: \'Open Sans Regular\';',
                    '}'
                ].join('\n'),
                expectedColumns: [
                    'population'
                ]
            },
            {
                cartocss: [
                    '#cities[population<1000] {',
                    '  text-face-name: \'Open Sans Regular\';',
                    '}'
                ].join('\n'),
                expectedColumns: [
                    'population'
                ]
            },
            {
                cartocss: [
                    '#cities[population>=1000] {',
                    '  text-face-name: \'Open Sans Regular\';',
                    '}'
                ].join('\n'),
                expectedColumns: [
                    'population'
                ]
            },
            {
                cartocss: [
                    '#cities[population<=1000] {',
                    '  text-face-name: \'Open Sans Regular\';',
                    '}'
                ].join('\n'),
                expectedColumns: [
                    'population'
                ]
            },
            {
                cartocss: [
                    '#cities[population=1000] {',
                    '  text-face-name: \'Open Sans Regular\';',
                    '}'
                ].join('\n'),
                expectedColumns: [
                    'population'
                ]
            },
            {
                cartocss: [
                    '#cities[population!=1000] {',
                    '  text-face-name: \'Open Sans Regular\';',
                    '}'
                ].join('\n'),
                expectedColumns: [
                    'population'
                ]
            },
            {
                cartocss: [
                    '#cities[population>1000000] {',
                    '  text-name: [name];',
                    '  text-face-name: \'Open Sans Regular\';',
                    '}'
                ].join('\n'),
                expectedColumns: [
                    'population',
                    'name'
                ]
            },
            {
                cartocss: [
                    '#cities[population>1000000] {',
                    '  text-name: [name];',
                    '}',
                    '#cities[population>100000] {',
                    '  text-name: [name];',
                    '}'
                ].join('\n'),
                expectedColumns: [
                    'population',
                    'name'
                ]
            },
            {
                cartocss: [
                    '#cities {',
                    '  marker-fill: red;',
                    '  text-name: [name];',
                    '  shield-name: [name_en];',
                    '}'
                ].join('\n'),
                expectedColumns: [
                    'name',
                    'name_en'
                ]
            },
            {
                cartocss: [
                    '#cities[class=\'metropolis\']{',
                    '  text-name: \'irrelevant\';',
                    '}'
                ].join('\n'),
                expectedColumns: [
                    'class'
                ]
            },
            {
                cartocss: [
                    '#layer[zoom>=4][zoom<=10] {',
                    '  line-color: red;',
                    '}',
                    ''
                ].join('\n'),
                expectedColumns: []
            },
            {
                cartocss: [
                    '#layer {',
                    '  [zoom=8] { line-width: 3; }',
                    '}',
                    ''
                ].join('\n'),
                expectedColumns: []
            },
            {
                cartocss: [
                    '#cities {',
                    '  [zoom>=4][population>1000000]{',
                    '    text-face-name: \'Open Sans Regular\';',
                    '  }',
                    '}',
                    ''
                ].join('\n'),
                expectedColumns: [
                    'population'
                ]
            },
            {
                cartocss: [
                    '#cities {',
                    '  [zoom>=4][population>1000000],',
                    '  [zoom>=5][population>500000],',
                    '  [zoom>=6][population>100000] {',
                    '    text-name: [name];',
                    '    text-face-name: \'Open Sans Regular\'',
                    '  }',
                    '}'
                ].join('\n'),
                expectedColumns: [
                    'population',
                    'name'
                ]
            },
            {
                cartocss: [
                    '#cities[address=~\'.*14th Street N.*\']{',
                    '  text-name: \'irrelevant\';',
                    '}'
                ].join('\n'),
                expectedColumns: [
                    'address'
                ]
            },
            {
                cartocss: [
                    '#cities[population>10000]{',
                    '  text-name: \'irrelevant\'; [category>4] { marker-fill: red; }',
                    '}'
                ].join('\n'),
                expectedColumns: [
                    'population',
                    'category'
                ]
            }
        ];

        testScenarios.forEach(function (scenario, i) {
            var itFn = scenario.only ? it.only : it;
            var desc = scenario.cartocss + ' should return ' + JSON.stringify(scenario.expectedColumns);
            itFn(i + '-' + desc, function () {
                var columns = cartocssUtils.getColumnNamesFromCartoCSS(scenario.cartocss);
                assert.deepEqual(columns, scenario.expectedColumns);
            });
        });

    });
});
