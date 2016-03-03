'use strict';

module.exports = function getUniqueColumnNames (cartocss) {
    var columnNames = [];

    var columnNamesFromVariables = getColumnNamesFromVariables(cartocss);
    var columnNamesFromExpressions = getColumnNamesFromExpresions(cartocss);
    var columnNamesFromRegex = getColumnNamesFromRegexs(cartocss);

    columnNames = columnNames.concat(columnNamesFromExpressions)
        .concat(columnNamesFromVariables)
        .concat(columnNamesFromRegex);

    return columnNames.filter(function (item, pos, self) {
        return self.indexOf(item) === pos;
    });
};

function getColumnNamesFromVariables(cartocss) {
    var matches, output = [];
    var variableRegex = /(?:\[) *([^"'=<>~]*?) *(?:\])/g;
    matches = variableRegex.exec(cartocss);

    while (matches) {
        if (isNaN(matches[1])) {
            output.push(matches[1]);
        }

        matches = variableRegex.exec(cartocss);
    }

    return output;
}

function getColumnNamesFromExpresions(cartocss) {
    var matches, output = [];
    var expressionRegex =
    /(?:\[) *([^"'\[\]]*?) *(?:(?:<=)|(?:>=)|(?:\!=)|(?:\=~)|(?:=)|(?:>)|(?:<)) *([^"'\[\]]*?) *(?:\])/g;
    matches = expressionRegex.exec(cartocss);

    while (matches) {
        if (isNaN(matches[1])) {
            output.push(matches[1]);
        }

        if (isNaN(matches[2])) {
            output.push(matches[2]);
        }

        matches = expressionRegex.exec(cartocss);
    }

    return output;
}

function getColumnNamesFromRegexs(cartocss) {
    var matches, output = [];
    var regexRegex = /(?:\[) *([^\[\]]*?) *(?:\=~) *([^\[\]]*?) *(?:\])/g;
    matches = regexRegex.exec(cartocss);

    while (matches) {
        if (isNaN(matches[1])) {
            output.push(matches[1]);
        }

        matches = regexRegex.exec(cartocss);
    }

    return output;
}
