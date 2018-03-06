var assert = require('assert');

var _ = require('underscore');
var PSQL = require('cartodb-psql');
var step = require('step');

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

    var mapConfig;
    var fid_col;
    step(
        function getMapConfig() {
            mapConfigProvider.getMapConfig(this);
        },
        function getPGClient(err, _mapConfig) {
            assert.ifError(err);

            mapConfig = _mapConfig;

            var dbParams = RendererParams.dbParamsFromReqParams(params);
            _.extend(dbParams, mapConfig.getLayerDatasource(params.layer));
            return new PSQL(dbParams);
        },
        function getAttributes(err, pg) {
            timer.start('getAttributes');

            assert.ifError(err);

            var layer = mapConfig.getLayer(params.layer);
            if ( ! layer ) {
                throw new Error("Map " + params.token + " has no layer number " + params.layer);
            }
            var attributes = layer.options.attributes;
            if ( ! attributes ) {
                throw new Error("Layer " + params.layer + " has no exposed attributes");
            }

            // NOTE: we're assuming that the presence of "attributes"
            //       means it is well-formed (should be checked at
            //       MapConfig construction/validation time).

            fid_col = attributes.id;
            var att_cols = attributes.columns;

            // prepare columns with double quotes
            var quoted_att_cols = _.map(att_cols, function(n) {
                return pg.quoteIdentifier(n);
            }).join(',');

            if ( testMode ) {
                quoted_att_cols += ',' + pg.quoteIdentifier(fid_col);
            }

            var layerSql = SubstitutionTokens.replace(layer.options.sql, {
                bbox: 'ST_MakeEnvelope(-20037508.34,-20037508.34,20037508.34,20037508.34,3857)',
                scale_denominator: '0',
                pixel_width: '1',
                pixel_height: '1'
            });

            var sql = 'select ' + quoted_att_cols + ' from ( ' + layerSql + ' ) as _windshaft_subquery ';
            if ( ! testMode ) {
                sql += ' WHERE ' + pg.quoteIdentifier(fid_col) + ' = ' + params.fid;
            } else {
                sql += ' LIMIT 1';
            }

            pg.query(sql, this, true); // use read-only transaction
        },
        function formatAttributes(err, data) {
            timer.end('getAttributes');
            assert.ifError(err);

            if ( data.rows.length !== 1 ) {
                if ( testMode ) {
                    return null;
                }
                else {
                    var rowsLengthError = new Error("Multiple features (" + data.rows.length + ") identified by '" +
                            fid_col + "' = " + params.fid + " in layer " + params.layer);
                    if ( ! data.rows.length ) {
                        rowsLengthError.http_status = 404;
                    }
                    throw rowsLengthError;
                }
            }
            return data.rows[0];
        },
        function returnCallback(err, attributes) {
            return callback(err, attributes, timer.getTimes());
        }
    );
};
