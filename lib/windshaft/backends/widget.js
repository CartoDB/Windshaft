var assert = require('assert');

var _ = require('underscore');
var PSQL = require('cartodb-psql');
var step = require('step');

var RendererParams = require('../renderers/renderer_params');
var Timer = require('../stats/timer');

function WidgetBackend() {
}

module.exports = WidgetBackend;


WidgetBackend.prototype.getWidget = function (mapConfigProvider, params, callback) {
    var timer = new Timer();

    var mapConfig;
    step(
        function getMapConfig() {
            mapConfigProvider.getMapConfig(this);
        },
        function getWidget(err, _mapConfig) {
            assert.ifError(err);

            mapConfig = _mapConfig;

            var widget = mapConfig.getWidget(params.layer, params.widgetName);
            if (!widget) {
                throw new Error("Widget '" + params.widgetName + "' does not exists");
            }

            return widget;
        },
        function runWidgetQuery(err, widget) {
            assert.ifError(err);

            var dbParams = RendererParams.dbParamsFromReqParams(params);
            _.extend(dbParams, mapConfig.getLayerDatasource(params.layer));
            var pg = new PSQL(dbParams);

            pg.query(widget.sql(), this, true); // use read-only transaction
        },
        function formatWidget(err, data) {
            assert.ifError(err);

            return data.rows;
        },
        function returnCallback(err, result) {
            return callback(err, result, timer.getTimes());
        }
    );
};
