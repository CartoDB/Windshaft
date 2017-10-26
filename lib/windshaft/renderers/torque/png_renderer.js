var Renderer = require('./renderer');
var torque = require('torque.js');
var Canvas = require('canvas');
var _ = require('underscore');
var carto = require('carto');
var request = require('request');
var Timer = require('../../stats/timer');

function PngRenderer(layer, sql, attrs) {
    var cartoCssOptions = torque.common.TorqueLayer.optionsFromCartoCSS(layer.options.cartocss);
    var rendererOptions = {
        bufferSize: cartoCssOptions['buffer-size'] !== undefined ? cartoCssOptions['buffer-size'] : 32
    };

    Renderer.apply(this, [layer, sql, attrs, rendererOptions]);

    this.canvasImages = [];
    var self = this;

    this.provider = new torque.providers.windshaft(_.extend(
        {
            no_fetch_map: true,
            coordinates_data_type: torque.types.Int16Array
        },
        cartoCssOptions
    ));
    this.rendererOptions = _.extend({}, layer.options, cartoCssOptions, {
        canvasClass: Canvas,
        imageClass: Canvas.Image,
        // TODO This should behave as a locking cache
        // It should not request the same file as many times as setImageSrc is invoked
        // Right now it will be called: (# different marker-files) * (# calls to renderer.Point.renderTile) times
        setImageSrc: function(img, url, callback) {

            self.canvasImages.push(img);

            var requestOpts = {
                url: url,
                method: 'GET',
                encoding: null, // if you expect binary data, you should set encoding: null
                gzip: true
            };
            request(requestOpts, function (err, response, body) {
                if (!err && response.statusCode === 200) {
                    img.onload = function() {
                        callback(null);
                    };
                    img.onerror = function() {
                        callback(new Error('Could not load marker-file image: ' + url));
                    };
                    img.src = body;
                } else {
                    callback(new Error('Could not load marker-file image: ' + url));
                }
            });
        },
        qualifyURL: function(url) {
            return url;
        }
    });

    this.step = layer.options.step || 0;
    var shader = new carto.RendererJS().render(layer.options.cartocss);
    this.stepOffset = Math.max.apply(Math, shader.getLayers().map(function(layer) {
        return layer.shader.frames.length;
    }));

    // keep it simple for now and render last step if requested step is bigger than maximum
    if (this.step >= cartoCssOptions.steps) {
        this.step = cartoCssOptions.steps - 1;
    }
}

PngRenderer.prototype = new Renderer();
PngRenderer.prototype.constructor = PngRenderer;

module.exports = PngRenderer;


PngRenderer.prototype.getTile = function(z, x, y, callback) {
    var self = this;
    var attrs = _.extend({stepSelect: this.step, stepOffset: this.stepOffset}, this.attrs);
    this.getTileData(this.sql, {x: x, y: y}, z, this.layer.options.sql, attrs, function(err, rows, headers, stats) {

        var timer = new Timer();
        timer.start('render');
        var canvas = new Canvas(self.tile_size, self.tile_size);
        var pointRenderer = new torque.renderer.Point(canvas, self.rendererOptions);

        try {
            pointRenderer.renderTile(self.provider.proccessTile(rows, {x: x, y: y}, z), self.step, function(err) {
                if (err) {
                    return callback(err, null, {});
                }
                pointRenderer.applyFilters();
                timer.end('render');

                timer.start('encode');
                canvas.toBuffer(function(err, buf) {
                    timer.end('encode');
                    callback(err, buf, {'Content-Type': 'image/png'}, _.extend(timer.getTimes(), stats));
                });
            });
        } catch (err) {
            callback(err, null, {});
        }
    });
};

PngRenderer.prototype.close = function() {
    this.canvasImages.forEach(function(img) {
        // unbind handlers so they don't callback anymore
        img.onerror = null;
        img.onload = null;
        // trick to avoid leak of image buffer
        img.src = null;
    });
    this.canvasImages = [];
};
