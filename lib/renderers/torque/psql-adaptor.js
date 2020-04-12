'use strict';

const Psql = require('cartodb-psql');

module.exports = class PSQLAdaptor {
    constructor ({ connectionParams, poolParams }) {
        this._psql = new Psql(connectionParams, poolParams);
    }

    query (sql, readonly = true) {
        return new Promise((resolve, reject) => {
            this._psql.query(sql, (err, result) => {
                if (err) {
                    return reject(err);
                }

                const fields = result.fields.reduce((fields, field) => {
                    const cname = this._psql.typeName(field.dataTypeID);
                    const type = cname ? typeName(cname) : `unknown(${field.dataTypeID})`;
                    fields[field.name] = { type };
                    return fields;
                }, {});

                return resolve({ fields, rows: result.rows });
            }, readonly);
        });
    }
};

function typeName (cname) {
    let tname = cname;

    if (cname.match('bool')) {
        tname = 'boolean';
    } else if (cname.match(/int|float|numeric/)) {
        tname = 'number';
    } else if (cname.match(/text|char|unknown/)) {
        tname = 'string';
    } else if (cname.match(/date|time/)) {
        tname = 'date';
    }

    if (tname && cname.match(/^_/)) {
        tname += '[]';
    }

    return tname;
}
