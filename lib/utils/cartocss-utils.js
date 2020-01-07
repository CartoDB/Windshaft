'use strict';

var carto = require('carto');
var torqueReference = require('torque.js').cartocss_reference;

module.exports.getColumnNamesFromCartoCSS = function (cartocss) {
    return selectors(cartocss);
};

carto.tree.Reference.setData(torqueReference.version.latest);

var MAP_ATTRIBUTES = ['buffer-size'];
module.exports.optionsFromCartoCSS = function (cartocss) {
    var shader = new carto.RendererJS().render(cartocss);
    var mapConfig = shader.findLayer({ name: 'Map' });

    var options = {};

    if (mapConfig) {
        MAP_ATTRIBUTES.reduce(function (opts, attributeName) {
            var v = mapConfig.eval(attributeName);
            if (v !== undefined) {
                opts[attributeName] = v;
            }
            return opts;
        }, options);
    }

    return options;
};

function selectors (cartocss) {
    var env = {
        benchmark: false,
        validation_data: false,
        effects: [],
        errors: [],
        error: function (e) {
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

function appendFiltersKeys (definitions, allSelectors) {
    definitions
        .reduce(function (filters, r) {
            if (r.filters && r.filters.filters) {
                Object.keys(r.filters.filters).forEach(function (filterId) {
                    allSelectors[r.filters.filters[filterId].key.value] = true;
                });
            }
            return filters;
        }, allSelectors);

    return allSelectors;
}

function appendRulesFields (definitions, allSelectors) {
    definitions
        .map(function (r) {
            return r.rules;
        })
        .reduce(function (allRules, rules) {
            return allRules.concat(rules);
        }, [])
        .reduce(function (allValues, rule) {
            return values(rule.value, allValues);
        }, [])
        .filter(function (values) {
            return values.is === 'field';
        })
        .map(function (rule) {
            return rule.value;
        })
        .reduce(function (keys, field) {
            keys[field] = true;
            return keys;
        }, allSelectors);

    return allSelectors;
}

function values (value, allValues) {
    allValues = allValues || [];
    if (value.is === 'value' || value.is === 'expression') {
        if (Array.isArray(value.value)) {
            value.value.forEach(function (_value) {
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
