'use strict';
var carto = require('carto');
var torque_reference = require('torque.js').cartocss_reference;

module.exports.getColumnNamesFromCartoCSS = function (cartocss) {
    return selectors(cartocss);
};

carto.tree.Reference.setData(torque_reference.version.latest);

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
        .filter(function(rule) {
            return rule.value.value[0].value[0].is === 'field';
        })
        .map(function(rule) {
            return rule.value.value[0].value[0].value;
        })
        .reduce(function(keys, field) {
            keys[field] = true;
            return keys;
        }, allSelectors);

    return allSelectors;
}
