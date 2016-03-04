'use strict';

module.exports = function getUniqueColumnNames (cartocss) {
    return getColumnNames(cartocss).filter(function (item, pos, self) {
        return self.indexOf(item) === pos;
    });
};

function getColumnNames (cartocss) {
    var columnNames = [];

    var regexs = [{
        regex: /(?:\[) *([^"'\[\]]*?) *(?:(?:<=)|(?:>=)|(?:\!=)|(?:\=~)|(?:=)|(?:>)|(?:<)) *([^"'\[\]]*?) *(?:\])/g,
        capturingGroups: 2
    }, {
        regex: /(?:\[) *([^"'=<>~]*?) *(?:\])/g,
        capturingGroups: 1
    }, {
        regex: /(?:\[) *([^\[\]]*?) *(?:\=~) *([^\[\]]*?) *(?:\])/g,
        capturingGroups: 1
    }];

    for (var i = 0; i < regexs.length; i++) {
        columnNames = columnNames.concat(getColumnNamesFromRegex(cartocss, regexs[i].regex, regexs[i].capturingGroups));
    }

    return columnNames;
}

function getColumnNamesFromRegex(cartocss, regex, capturingGroups) {
    var columnNames = [];
    var matches = regex.exec(cartocss);

    while (matches) {
        for (var i = 1; i <= capturingGroups; i++) {
            if (isNaN(matches[i])) {
                columnNames.push(matches[i]);
            }
        }

        matches = regex.exec(cartocss);
    }

    return columnNames;
}
