'use strict';

var CartoPSQL = require('cartodb-psql');

module.exports = function cartoPSQLFactory(dbParams, dbPoolParams) {
    return new CartoPSQL(dbParams, dbPoolParams);
};
