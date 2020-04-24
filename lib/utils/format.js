'use strict';

module.exports = function format (str) {
    const replacements = Array.prototype.slice.call(arguments, 1);

    for (const attrs of replacements) {
        for (const [key, attr] of Object.entries(attrs)) {
            str = str.replace(new RegExp(`\\{${key}\\}`, 'g'), attr);
        }
    }

    return str;
};
