var _ = require('underscore');

module.exports = {
    createKey: createKey,
    dbParamsFromReqParams: dbParamsFromReqParams
};

// Configure bases for cache keys suitable for string interpolation
var baseKey   = "<%= dbname %>:<%= table %>:";
var renderKey = baseKey + "<%= dbuser %>:<%= format %>:<%= geom_type %>:<%= sql %>:<%= layer %>:<%= interactivity %>:<%= style %>:<%= style_version %>:<%= scale_factor %>";
// Create a string ID/key from a set of params
function createKey(params, base) {
    var opts =  _.extend({}, params); // as params is a weird arrayobj right here
    delete opts.x;
    delete opts.y;
    delete opts.z;
    delete opts.callback;
    if ( ! opts.table ) {
        opts.table = opts.token;
        // interactivity is encoded in token
        delete opts.interactivity;
    }
    _.defaults(opts, {
        dbname:'', dbuser:'', table:'',
        format:'', geom_type:'', sql:'',
        interactivity:'', layer:'', style:'', style_version:'',
        scale_factor: 1
    });
    return _.template(base ? baseKey : renderKey, opts);
}

function dbParamsFromReqParams(params) {
    var dbParams = {};
    if ( params.dbuser ) dbParams.user = params.dbuser;
    if ( params.dbpassword ) dbParams.pass = params.dbpassword;
    if ( params.dbhost ) dbParams.host = params.dbhost;
    if ( params.dbport ) dbParams.port = params.dbport;
    if ( params.dbname ) dbParams.dbname = params.dbname;
    return dbParams;
}
