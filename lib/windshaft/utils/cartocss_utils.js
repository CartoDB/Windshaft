'use strict';

module.exports = function getColumnNames (cartocss) {
    var matches, output = [];
    var regex = /(?:\[) *(.*?) *?(?:(?:\<\=)|(?:\=)|(?:\>\=)|(?:\>)|(?:\<)) *(.*?) *(?:\])/g;
    matches = regex.exec(cartocss);

    while (matches) {
        output.push(matches[1]);
        matches = regex.exec(cartocss);
    }

    return output;
};
