'use strict';

const PSQL = require('cartodb-psql');

const RendererParams = require('../renderers/renderer-params');
const Timer = require('../stats/timer');
const SubstitutionTokens = require('cartodb-query-tables').utils.substitutionTokens;

function AttributesBackend () {}

module.exports = AttributesBackend;

/// Gets attributes for a given layer feature
//
/// Calls req2params, then expects parameters:
///
/// * token - MapConfig identifier
/// * layer - Layer number
/// * fid   - Feature identifier
///
/// The referenced layer must have been configured
/// to allow for attributes fetching.
/// See https://github.com/CartoDB/Windshaft/wiki/MapConfig-1.1.0
///
/// @param testMode if true generates a call returning requested
///                 columns plus the fid column of the first record
///                 it is only meant to check validity of configuration
///
AttributesBackend.prototype.getFeatureAttributes = function (mapConfigProvider, params, testMode, callback) {
    const timer = new Timer();

    mapConfigProvider.getMapConfig((err, mapConfig) => {
        if (err) {
            return callback(err);
        }

        const layer = mapConfig.getLayer(params.layer);
        if (!layer) {
            const error = new Error(`Map ${params.token} has no layer number ${params.layer}`);
            return callback(error);
        }

        timer.start('getAttributes');
        const attributes = layer.options.attributes;
        if (!attributes) {
            const error = new Error(`Layer ${params.layer} has no exposed attributes`);
            return callback(error);
        }

        const dbParams = Object.assign(
            {},
            RendererParams.dbParamsFromReqParams(params),
            mapConfig.getLayerDatasource(params.layer)
        );

        let pg;
        try {
            pg = new PSQL(dbParams);
        } catch (error) {
            return callback(error);
        }

        const sql = getSQL(attributes, pg, layer, params, testMode);

        pg.query(sql, (err, data) => {
            timer.end('getAttributes');

            if (err) {
                return callback(err);
            }

            if (testMode) {
                return callback(null, null, timer.getTimes());
            }

            const featureAttributes = extractFeatureAttributes(data.rows);

            if (!featureAttributes) {
                const rowsLengthError = new Error(
                    `Multiple features (${data.rows.length}) identified by ` +
                    `'${attributes.id}' = ${params.fid} in layer ${params.layer}`
                );
                if (!data.rows.length) {
                    rowsLengthError.http_status = 404;
                }
                return callback(rowsLengthError);
            }

            return callback(null, featureAttributes, timer.getTimes());
        }, true); // use read-only transaction
    });
};

function getSQL (attributes, pg, layer, params, testMode) {
    // NOTE: we're assuming that the presence of "attributes"
    //       means it is well-formed (should be checked at
    //       MapConfig construction/validation time).

    // prepare columns with double quotes
    let quotedAttCols = attributes.columns
        .map(n => pg.quoteIdentifier(n))
        .join(',');

    if (testMode) {
        quotedAttCols += ',' + pg.quoteIdentifier(attributes.id);
    }

    const layerSql = SubstitutionTokens.replaceXYZ(layer.options.sql);

    let sql = `SELECT ${quotedAttCols} FROM (${layerSql}) AS _windshaft_subquery`;
    if (!testMode) {
        sql += ` WHERE ${pg.quoteIdentifier(attributes.id)} = ${params.fid}`;
    } else {
        sql += ' LIMIT 1';
    }

    return sql;
}

function extractFeatureAttributes (data) {
    if (data.length === 1) {
        return data[0];
    }

    if (data.length > 1) {
        // If we receive more than one row for the id (usually `cartodb_id`)
        // we want to check that the attributes received are truly different before
        // returning an error.
        const uniqueAttributes = [...new Set(data.map(r => JSON.stringify(r)))];
        if (uniqueAttributes.length === 1) {
            return data[0];
        }
    }

    return null;
}
