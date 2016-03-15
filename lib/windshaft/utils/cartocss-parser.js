'use strict';

var carto = require('carto');

function CartocssParser() {

}

module.exports = CartocssParser;

CartocssParser.prototype.getColumnNames = function (cartocss) {
    var tree = new carto.Parser().parse(cartocss);

    console.log(JSON.stringify(tree));
};
