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

            var ownFilter = +params.own_filter;
            ownFilter = !!ownFilter;

            var filters;
            if (ownFilter) {
                filters = mapConfig.getLayerFilters(layerIndex);
            } else {
                filters = mapConfig.getLayerFilters(layerIndex, params.widgetName);
            }

            if (params.bbox) {
                filters = filters.concat(new BBoxFilter({}, {bbox: params.bbox}));
            }

            var overrideParams = _.reduce(_.pick(params, 'start', 'end', 'bins'), function(overrides, val, k) {
                overrides[k] = +val;
                return overrides;
            }, {});

            widget.getResult(pg, filters, overrideParams, this);

        },
        function returnCallback(err, result) {
            return callback(err, result, timer.getTimes());
        }
    );
};
