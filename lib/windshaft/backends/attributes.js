var assert = require('assert');

var _ = require('underscore');
var PSQL = require('cartodb-psql');
var step = require('step');

var MapValidatorBackend = require('./map_validator');
var RendererParams = require('../renderers/renderer_params');
var Timer = require('../stats/timer');

function AttributesBackend(rendererCache, mapStore) {
    this._rendererCache = rendererCache;
    this._mapStore = mapStore;
    this._mapValidatorBackend = new MapValidatorBackend(this);
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
AttributesBackend.prototype.getFeatureAttributes = function (params, testMode, callback) {
    var self = this;

    var timer = new Timer();

    var mapConfig;
    step(
        function getMapConfig() {
            timer.start('MapStore.load');
            self._mapStore.load(params.token, this);
        },
        function getPGClient(err, data) {
            assert.ifError(err);

            timer.end('MapStore.load');
            mapConfig = data;

            var dbParams = RendererParams.dbParamsFromReqParams(params);
            _.extend(dbParams, mapConfig.getLayerDatasource(params.layer));
            return new PSQL(dbParams);
        },
        function getAttributes(err, pg) {
            timer.start('getAttributes');

            assert.ifError(err);

            var layer = mapConfig.getLayer(params.layer);
            if ( ! layer ) {
                throw new Error("Map " + params.token +
                    " has no layer number " + params.layer);
            }
            var attributes = layer.options.attributes;
            if ( ! attributes ) {
                throw new Error("Layer " + params.layer +
                    " has no exposed attributes");
            }

            // NOTE: we're assuming that the presence of "attributes"
            //       means it is well-formed (should be checked at
            //       MapConfig construction/validation time).

            var fid_col = attributes.id;
            var att_cols = attributes.columns;

            // prepare columns with double quotes
            var quoted_att_cols = _.map(att_cols, function(n) {
                return pg.quoteIdentifier(n);
            }).join(',');

            if ( testMode ) {
                quoted_att_cols += ',' + pg.quoteIdentifier(fid_col);
            }

            var sql = 'select ' + quoted_att_cols + ' from ( ' + layer.options.sql + ' ) as _windshaft_subquery ';
            if ( ! testMode ) {
                sql += ' WHERE ' + pg.quoteIdentifier(fid_col) + ' = ' + params.fid;
            } else {
                sql += ' LIMIT 1';
            }

            // console.log("SQL:  " + sql);

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
                    var rowsLengthError = new Error(data.rows.length +
                        " features in layer " + params.layer +
                        " of map " + params.token +
                        " are identified by fid " + params.fid);
                    if ( ! data.rows.length ) {
                        rowsLengthError.http_status = 404;
                    }
                    throw rowsLengthError;
                }
            }
            return data.rows[0];
        },
        function returnCallback(err, tile) {
            return callback(err, tile, timer.getTimes());
        }
    );
};
