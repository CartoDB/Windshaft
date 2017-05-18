var SUBSTITUTION_TOKENS = {
    bbox: /!bbox!/g,
    scale_denominator: /!scale_denominator!/g,
    pixel_width: /!pixel_width!/g,
    pixel_height: /!pixel_height!/g,
    var_zoom: /@zoom/g,
    var_bbox: /@bbox/g,
    var_x: /@x/g,
    var_y: /@y/g,
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
