var filters = require('./');

function FilterFactory() {
    this.filters = Object.keys(filters).reduce(function(acc, filterClassName) {
        acc[filterClassName.toLowerCase()] = filters[filterClassName];
        return acc;
    }, {});
}


module.exports = FilterFactory;

FilterFactory.prototype.getFilter = function(filterDefinition, filterParams) {
    var type = filterDefinition.type;

    if (!this.filters[type]) {
        throw new Error('Invalid filter type: "' + type + '"');
    }

    return new this.filters[type](filterDefinition, filterParams);
};
