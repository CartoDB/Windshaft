var Renderer = require('./renderer');
var torque = require('torque.js');
var _ = require('underscore');
var carto = require('carto');
var workerFarm = require('worker-farm');

function PngRenderer(layer, sql, attrs) {
    Renderer.apply(this, [layer, sql, attrs]);

    this.cartoCssOptions = torque.common.TorqueLayer.optionsFromCartoCSS(layer.options.cartocss);
    this.rendererOptions = _.extend({}, layer.options, this.cartoCssOptions);

    this.step = layer.options.step || 0;
    var shader = new carto.RendererJS().render(layer.options.cartocss);
    this.stepOffset = Math.max.apply(Math, shader.getLayers().map(function(layer) {
        return layer.shader.frames.length;
    }));

    // keep it simple for now and render last step if requested step is bigger than maximum
    if (this.step >= this.cartoCssOptions.steps) {
        this.step = this.cartoCssOptions.steps - 1;
    }

    this.worker = workerFarm(require.resolve('./canvas_renderer_worker'));
}

PngRenderer.prototype = new Renderer();
PngRenderer.prototype.constructor = PngRenderer;

module.exports = PngRenderer;


PngRenderer.prototype.getTile = function(z, x, y, callback) {
    var self = this;
    var attrs = _.extend({stepSelect: this.step, stepOffset: this.stepOffset}, this.attrs);
    this.getTileData(this.sql, {x: x, y: y}, z, this.layer.options.sql, attrs, function(err, rows) {

        var renderRequest = {
            tile_size: self.tile_size,
            cartoCssOptions: self.cartoCssOptions,
            rendererOptions: self.rendererOptions,
            step: self.step,
            z: z,
            x: x,
            y: y,
            rows: rows
        };

        self.worker(renderRequest, function(err, buf, headers) {
            if (err || !buf) {
                return callback(err, null, {});
            }
            return callback(err, new Buffer(buf), headers);
        });
    });
};

PngRenderer.prototype.endWorkerFarm = function() {
    workerFarm.end(this.worker);
};
