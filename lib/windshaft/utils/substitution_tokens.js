'use strict';

var SUBSTITUTION_TOKENS = {
    tile_bbox: /!tile_bbox!/g,
    bbox: /!bbox!/g,
    scale_denominator: /!scale_denominator!/g,
    pixel_width: /!pixel_width!/g,
    pixel_height: /!pixel_height!/g
};

var SubstitutionTokens = {
    replace: function(sql, replaceValues) {
        Object.keys(replaceValues).forEach(function(token) {
            if (SUBSTITUTION_TOKENS[token]) {
                sql = sql.replace(SUBSTITUTION_TOKENS[token], replaceValues[token]);
            }
        });
        return sql;
    }
};

module.exports = SubstitutionTokens;
