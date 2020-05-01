'use strict';

const carto = require('carto');
const torqueReference = require('torque.js').cartocss_reference;
const MAP_ATTRIBUTES = ['buffer-size'];
carto.tree.Reference.setData(torqueReference.version.latest);

module.exports.getColumnNamesFromCartoCSS = function getColumnNamesFromCartoCSS (cartocss) {
    return selectors(cartocss);
};

module.exports.optionsFromCartoCSS = function optionsFromCartoCSS (cartocss) {
    const shader = new carto.RendererJS().render(cartocss);
    const mapConfig = shader.findLayer({ name: 'Map' });

    const options = {};

    if (mapConfig) {
        MAP_ATTRIBUTES.reduce((opts, attributeName) => {
            const v = mapConfig.eval(attributeName);

            if (v !== undefined) {
                opts[attributeName] = v;
            }

            return opts;
        }, options);
    }

    return options;
};

function selectors (cartocss) {
    const env = {
        benchmark: false,
        validation_data: false,
        effects: [],
        errors: [],
        error: function (e) {
            this.errors.push(e);
        }
    };
    const parser = carto.Parser(env);
    const tree = parser.parse(cartocss);
    const definitions = tree.toList(env);

    const allSelectors = {};
    appendFiltersKeys(definitions, allSelectors);
    appendRulesFields(definitions, allSelectors);

    return Object.keys(allSelectors);
}

function appendFiltersKeys (definitions, allSelectors) {
    definitions
        .reduce((filters, r) => {
            if (r.filters && r.filters.filters) {
                Object.keys(r.filters.filters).forEach((filterId) => {
                    allSelectors[r.filters.filters[filterId].key.value] = true;
                });
            }
            return filters;
        }, allSelectors);

    return allSelectors;
}

function appendRulesFields (definitions, allSelectors) {
    definitions
        .map((r) => r.rules)
        .reduce((allRules, rules) => allRules.concat(rules), [])
        .reduce((allValues, rule) => values(rule.value, allValues), [])
        .filter((values) => values.is === 'field')
        .map((rule) => rule.value)
        .reduce((keys, field) => {
            keys[field] = true;
            return keys;
        }, allSelectors);

    return allSelectors;
}

function values (value, allValues) {
    allValues = allValues || [];

    if (value.is === 'value' || value.is === 'expression') {
        if (Array.isArray(value.value)) {
            value.value.forEach((_value) => values(_value, allValues));
        } else {
            values(value.value, allValues);
        }
    } else {
        allValues.push(value);
    }

    return allValues;
}
