var assert = require('assert');

var _ = require('underscore');
var PSQL = require('cartodb-psql');
var step = require('step');

var RendererParams = require('../renderers/renderer_params');
var Timer = require('../stats/timer');
var BBoxFilter = require('../models/filters/bbox');

function WidgetBackend() {
}

module.exports = WidgetBackend;


WidgetBackend.prototype.getWidget = function (mapConfigProvider, params, callback) {
    var timer = new Timer();

    var layerIndex = params.layer;

    var mapConfig;
    var widget;
    step(
        function getMapConfig() {
            mapConfigProvider.getMapConfig(this);
        },
        function getWidget(err, _mapConfig) {
            assert.ifError(err);

            mapConfig = _mapConfig;

            var widget = mapConfig.getWidget(layerIndex, params.widgetName);
            if (!widget) {
                throw new Error("Widget '" + params.widgetName + "' does not exists");
            }

            return widget;
        },
        function runWidgetQuery(err, _widget) {
            assert.ifError(err);

            widget = _widget;

            var dbParams = RendererParams.dbParamsFromReqParams(params);
            _.extend(dbParams, mapConfig.getLayerDatasource(params.layer));
            var pg = new PSQL(dbParams);

            var allFilters = mapConfig.getLayerFilters(layerIndex);
            var noOwnFilters = mapConfig.getLayerFilters(layerIndex, params.widgetName);
            if (params.bbox) {
                var bboxFilter = new BBoxFilter({}, {bbox: params.bbox});
                allFilters = allFilters.concat(bboxFilter);
                noOwnFilters = noOwnFilters.concat(bboxFilter);
            }

            widget.getResult(pg, allFilters, noOwnFilters, _.pick(params, 'start', 'end'), this);
        },
        function returnCallback(err, result) {
            return callback(err, result, timer.getTimes());
        }
    );
};
