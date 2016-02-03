// Dummy query-rewriter which doesn't alter queries

// This class implements the Windshaft query rewriting API:
//
// * query(sql, data) // transform SQL query, with additional data
// * style(cartocss, casrtocss_version, data) // transform cartoCSS
//
function QueryRewriter() {
}

module.exports = QueryRewriter;

QueryRewriter.prototype.query = function(query, data) {
    // Not using data parameter, but declared here for documentation purposes
    // jshint unused: false
    return query;
};

QueryRewriter.prototype.style = function(cartocss, cartocss_version, data) {
    // Not using data parameter, but declared here for documentation purposes
    // jshint unused: false
    return cartocss;
};
