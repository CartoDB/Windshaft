'use strict';

module.exports = function parseDbParams (params) {
    const dbParams = {};

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
};
