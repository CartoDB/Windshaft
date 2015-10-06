var assert = require('assert');

var _ = require('underscore');
var PSQL = require('cartodb-psql');
var step = require('step');

var RendererParams = require('../renderers/renderer_params');
var Timer = require('../stats/timer');

function ListBackend() {
}

module.exports = ListBackend;

ListBackend.prototype.getList = function (mapConfigProvider, params, callback) {
    var timer = new Timer();

    var mapConfig;
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
        function getList(err, pg) {

            assert.ifError(err);

            var lists = mapConfig.getLists();
            if (!lists || Object.keys(lists).length === 0) {
                throw new Error("MapConfig has no exposed lists");
            }

            var list = lists[params.listName];
            if (!list) {
                throw new Error("List '" + params.listName + "' does not exists");
            }

            var sql = 'select ' + list.columns().join(', ') + ' from ( ' + list.sql() + ' ) as _windshaft_subquery ';

            pg.query(sql, this, true); // use read-only transaction
        },
        function formatList(err, data) {
            assert.ifError(err);

            return data.rows;
        },
        function returnCallback(err, list) {
            return callback(err, list, timer.getTimes());
        }
    );
};
