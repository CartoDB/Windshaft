var Canvas = require('canvas');
var torque = require('torque.js');
var _ = require('underscore');

module.exports = function (renderRequest, callback) {

    var z = renderRequest.z,
        x = renderRequest.x,
        y = renderRequest.y,
        step = renderRequest.step;

    var rendererOptions = _.extend({
        canvasClass: Canvas,
        imageClass: Canvas.Image,
        qualifyURL: function(url) {
            return url;
        }
    }, renderRequest.rendererOptions);

    var canvas = new Canvas(renderRequest.tile_size, renderRequest.tile_size);
    var pointRenderer = new torque.renderer.Point(canvas, rendererOptions);
    var provider = new torque.providers.windshaft(_.extend({ no_fetch_map: true }, renderRequest.cartoCssOptions));

    try {
        pointRenderer.renderTile(provider.proccessTile(renderRequest.rows, {x: x, y: y}, z), step);
    } catch (err) {
        callback(err, null, {});
    }

    canvas.toBuffer(function(err, buf) {
        callback(err, buf, {'Content-Type': 'image/png'});
    });
};
