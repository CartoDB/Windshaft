'use strict';

var carto = require('carto');
var torque_reference = require('torque.js').cartocss_reference;
var postcss = require('postcss');

module.exports.getColumnNamesFromCartoCSS = function (cartocss) {
    return selectors(cartocss);
};

carto.tree.Reference.setData(torque_reference.version.latest);

var MAP_SELECTOR = 'Map';
var MAP_ATTRIBUTES = ['buffer-size'];
var BUFFER_SIZE_ATTRIBUTE = MAP_ATTRIBUTES[0];

module.exports.optionsFromCartoCSS = function(cartocss) {
    var shader = new carto.RendererJS().render(cartocss);
    var mapConfig = shader.findLayer({ name: 'Map' });

    var options = {};

    if (mapConfig) {
        MAP_ATTRIBUTES.reduce(function(opts, attributeName) {
            // jshint evil:true
            var v = mapConfig.eval(attributeName);
            // jshint evil:false
            if (v !== undefined) {
                opts[attributeName] = v;
            }
            return opts;
        }, options);
    }

    return options;
};

function selectors(cartocss) {
    var env = {
        benchmark: false,
        validation_data: false,
        effects: [],
        errors: [],
        error: function(e) {
            this.errors.push(e);
        }
    };
    var parser = carto.Parser(env);
    var tree = parser.parse(cartocss);
    var definitions = tree.toList(env);

    var allSelectors = {};
    appendFiltersKeys(definitions, allSelectors);
    appendRulesFields(definitions, allSelectors);

    return Object.keys(allSelectors);
}

function appendFiltersKeys(definitions, allSelectors) {
    definitions
        .reduce(function(filters, r) {
            if (r.filters && r.filters.filters) {
                Object.keys(r.filters.filters).forEach(function(filterId) {
                    allSelectors[r.filters.filters[filterId].key.value] = true;
                });
            }
            return filters;
        }, allSelectors);

    return allSelectors;
}

function appendRulesFields(definitions, allSelectors) {
    definitions
        .map(function(r) {
            return r.rules;
        })
        .reduce(function(allRules, rules) {
            return allRules.concat(rules);
        }, [])
        .reduce(function(allValues, rule) {
            return values(rule.value, allValues);
        }, [])
        .filter(function(values) {
            return values.is === 'field';
        })
        .map(function(rule) {
            return rule.value;
        })
        .reduce(function(keys, field) {
            keys[field] = true;
            return keys;
        }, allSelectors);

    return allSelectors;
}

function values(value, allValues) {
    allValues = allValues || [];
    if (value.is === 'value' || value.is === 'expression') {
        if (Array.isArray(value.value)) {
            value.value.forEach(function(_value) {
                values(_value, allValues);
            });
        } else {
            values(value.value, allValues);
        }
    } else {
        allValues.push(value);
    }
    return allValues;
}

module.exports.getMaxBufferSizeFromCartoCSS = function getMaxBufferSizeFromCartoCSS (cartoCSSList) {
    return getBufferSizeValues(cartoCSSList)
        .reduce(function (max, current) {
            return Math.max(max, current);
        }, 0);
};

function getBufferSizeValues (cartoCssList) {
    return cartoCssList
        .map(function (cartoCss) {
            return getBufferSizeValue(cartoCss);
        })
        .filter(function (bufferSize) {
            return !!bufferSize;
        });
}

function getBufferSizeValue (cartoCSS) {
    return postcss()
        .use(postcssBufferSize())
        .process(cartoCSS)
        .messages.map(function (message) {
            return message.bufferSize;
        })
        .filter(function (message) {
            return message.bufferSize !== 'undefined';
        })
        .pop(); // last definition of bufferSize
}

var postcssBufferSize = postcss.plugin('postcss-buffer-size', function () {
    return function (root, result) {
        root.walkRules(MAP_SELECTOR, function (rule) {
            rule.walkDecls(BUFFER_SIZE_ATTRIBUTE, function (decl) {
                result.messages.push({ bufferSize: decl.value });
            });
        });
    };
});
