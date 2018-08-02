var _ = require('underscore');
var PSQL = require('cartodb-psql');

var RendererParams = require('../renderers/renderer_params');
var Timer = require('../stats/timer');
var SubstitutionTokens = require('../utils/substitution_tokens');

function AttributesBackend() {
}

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
    var timer = new Timer();

    mapConfigProvider.getMapConfig((err, mapConfig) => {
        if (err) {
            return callback(err);
        }

        var layer = mapConfig.getLayer(params.layer);
        if (!layer) {
            const error = new Error(`Map ${params.token} has no layer number ${params.layer}`);
            return callback(error);
        }

        timer.start('getAttributes');
        var attributes = layer.options.attributes;
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

        // NOTE: we're assuming that the presence of "attributes"
        //       means it is well-formed (should be checked at
        //       MapConfig construction/validation time).

        // prepare columns with double quotes
        var quoted_att_cols = attributes.columns
            .map(n => pg.quoteIdentifier(n))
            .join(',');

        var fid_col = attributes.id;
        if (testMode) {
            quoted_att_cols += ',' + pg.quoteIdentifier(fid_col);
        }

        var layerSql = SubstitutionTokens.replace(layer.options.sql, {
            bbox: 'ST_MakeEnvelope(-20037508.34,-20037508.34,20037508.34,20037508.34,3857)',
            scale_denominator: '0',
            pixel_width: '1',
            pixel_height: '1'
        });

        var sql = `SELECT ${quoted_att_cols} FROM (${layerSql}) AS _windshaft_subquery`;
        if (!testMode) {
            sql += ` WHERE ${pg.quoteIdentifier(fid_col)} = ${params.fid}`;
        } else {
            sql += ' LIMIT 1';
        }

        pg.query(sql, (err, data) => {
            timer.end('getAttributes');

            if (err) {
                return callback(err);
            }

            if (data.rows.length !== 1) {
                if (testMode) {
                    return callback(null, null, timer.getTimes());
                }

                if (data.rows.length > 1) {
                    // If we receive more than one row for the id (usually `cartodb_id`)
                    // we want to check that the attributes received are truly different before
                    // returning an error.
                    const uniqueAttributes = [...new Set(data.rows.map(r => JSON.stringify(r)))];
                    if (uniqueAttributes.length === 1) {
                        return callback(null, data.rows[0], timer.getTimes());
                    }
                }

                const rowsLengthError = new Error(
                    `Multiple features (${data.rows.length}) identified by '${fid_col}' = ${params.fid} in layer ${params.layer}`
                );
                if (!data.rows.length) {
                    rowsLengthError.http_status = 404;
                }
                return callback(rowsLengthError);
            }
            return callback(null, data.rows[0], timer.getTimes());
        } , true); // use read-only transaction
    });
};
