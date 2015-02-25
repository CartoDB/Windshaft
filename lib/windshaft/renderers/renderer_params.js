var _ = require('underscore');

module.exports = {
    createKey: createKey,
    dbParamsFromReqParams: dbParamsFromReqParams
};

// Configure bases for cache keys suitable for string interpolation
var baseKey   = "<%= dbname %>:<%= token %>";
var renderKey = baseKey + ":<%= dbuser %>:<%= format %>:<%= layer %>:<%= scale_factor %>";
// Create a string ID/key from a set of params
function createKey(params, base) {
    return _.template(base ? baseKey : renderKey, _.defaults({}, params, {
        dbname: '',
        token: '',
        dbuser: '',
        format: '',
        layer: '',
        scale_factor: 1
    }));
}

function dbParamsFromReqParams(params) {
    var dbParams = {};
    if ( params.dbuser ) {
        dbParams.user = params.dbuser;
    }
    if ( params.dbpassword ) {
        dbParams.pass = params.dbpassword;
    }
    if ( params.dbhost ) {
        dbParams.host = params.dbhost;
    }
    if ( params.dbport ) {
        dbParams.port = params.dbport;
    }
    if ( params.dbname ) {
        dbParams.dbname = params.dbname;
    }
    return dbParams;
}
