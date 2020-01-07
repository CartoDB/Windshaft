'use strict';

function PSQLAdaptor (PSQLClass, poolParams) {
    var ctor = function (params) {
        this._psql = new PSQLClass(params, poolParams);
    };
    ctor.prototype.query = function (sql, callback, readonly) {
        this._psql.query(sql, this._handleResult.bind(this, callback), readonly);
    };
    ctor.prototype._handleResult = function (callback, err, result) {
        if (err) { callback(err); return; }
        var formatted = {
            fields: this._formatResultFields(result.fields),
            rows: result.rows
        };
        callback(null, formatted);
    };
    ctor.prototype._formatResultFields = function (flds) {
        var nfields = {};
        for (var i = 0; i < flds.length; ++i) {
            var f = flds[i];
            var cname = this._psql.typeName(f.dataTypeID);
            var tname;
            if (!cname) {
                tname = 'unknown(' + f.dataTypeID + ')';
            } else {
                tname = typeName(cname);
            }
            // console.log('cname:'+cname+' tname:'+tname);
            nfields[f.name] = { type: tname };
        }
        return nfields;
    };

    return ctor;
}

function typeName (cname) {
    var tname = cname;

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

module.exports = PSQLAdaptor;
