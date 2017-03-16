function format(str) {
    var replacements = Array.prototype.slice.call(arguments, 1);

    replacements.forEach(function(attrs) {
        Object.keys(attrs).forEach(function(attr) {
            str = str.replace(new RegExp('\\{' + attr + '\\}', 'g'), attrs[attr]);
        });
    });

    return str;
}

module.exports = format;
