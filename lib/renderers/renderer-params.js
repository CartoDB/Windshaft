'use strict';

var RendererParams = {
    dbParamsFromReqParams: function (params) {
        var dbParams = {};
        if (params.dbuser) {
            dbParams.user = params.dbuser;
        }
        if (params.dbpassword) {
            dbParams.pass = params.dbpassword;
        }
        if (params.dbhost) {
            dbParams.host = params.dbhost;
        }
        if (params.dbport) {
            dbParams.port = params.dbport;
        }
        if (params.dbname) {
            dbParams.dbname = params.dbname;
        }
        return dbParams;
    }
};

module.exports = RendererParams;
