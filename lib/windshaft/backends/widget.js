var assert = require('assert');

var _ = require('underscore');
var PSQL = require('cartodb-psql');
var step = require('step');

var RendererParams = require('../renderers/renderer_params');
var Timer = require('../stats/timer');

function WidgetBackend() {
}

module.exports = WidgetBackend;

WidgetBackend.prototype.getList = function (mapConfigProvider, params, callback) {
    this.getWidgetResult(function(mapConfig, callback) {

        var list = mapConfig.getList(params.layer, params.listName);
        if (!list) {
            return callback(new Error("List '" + params.listName + "' does not exists"));
        }

        return callback(null, list);

    }, mapConfigProvider, params, callback);
};

WidgetBackend.prototype.getHistogram = function (mapConfigProvider, params, callback) {
    this.getWidgetResult(function(mapConfig, callback) {

        var histogram = mapConfig.getHistogram(params.layer, params.histogramName);
        if (!histogram) {
            return callback(new Error("Histogram '" + params.histogramName + "' does not exists"));
        }

        return callback(null, histogram);

    }, mapConfigProvider, params, callback);
};

WidgetBackend.prototype.getWidgetResult = function (getWidgetFn, mapConfigProvider, params, callback) {
    var timer = new Timer();

    var mapConfig;
    step(
        function getMapConfig() {
            mapConfigProvider.getMapConfig(this);
        },
        function getWidget(err, _mapConfig) {
            assert.ifError(err);

            mapConfig = _mapConfig;

            getWidgetFn(mapConfig, this);
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
