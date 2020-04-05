'use strict';

const TorqueRenderer = require('./renderer');
const torque = require('torque.js');
const { createCanvas, Canvas, Image } = require('canvas');
const carto = require('carto');
const request = require('request');
const Timer = require('../../stats/timer');
const { promisify } = require('util');

module.exports = class TorquePngRenderer extends TorqueRenderer {
    constructor (layer, sql, attrs) {
        const cartoCssOptions = torque.common.TorqueLayer.optionsFromCartoCSS(layer.options.cartocss);
        const rendererOptions = {
            bufferSize: cartoCssOptions['buffer-size'] !== undefined ? cartoCssOptions['buffer-size'] : 32
        };

        super(layer, sql, attrs, rendererOptions);

        this.canvasImages = [];
        const self = this;

        this.provider = new torque.providers.windshaft(Object.assign( // eslint-disable-line new-cap
            {
                no_fetch_map: true,
                coordinates_data_type: torque.types.Int16Array
            },
            cartoCssOptions
        ));
        this.rendererOptions = Object.assign({}, layer.options, cartoCssOptions, {
            canvasClass: Canvas,
            imageClass: Image,
            // TODO This should behave as a locking cache
            // It should not request the same file as many times as setImageSrc is invoked
            // Right now it will be called: (# different marker-files) * (# calls to renderer.Point.renderTile) times
            setImageSrc: function (img, url, callback) {
                self.canvasImages.push(img);

                const requestOpts = {
                    url: url,
                    method: 'GET',
                    encoding: null, // if you expect binary data, you should set encoding: null
                    gzip: true
                };
                request(requestOpts, function (err, response, body) {
                    if (!err && response.statusCode === 200) {
                        img.onload = function () {
                            callback(null);
                        };
                        img.onerror = function () {
                            callback(new Error('Could not load marker-file image: ' + url));
                        };
                        img.src = body;
                    } else {
                        callback(new Error('Could not load marker-file image: ' + url));
                    }
                });
            },
            qualifyURL: function (url) {
                return url;
            }
        });

        this.step = layer.options.step || 0;
        const shader = new carto.RendererJS().render(layer.options.cartocss);
        this.stepOffset = Math.max.apply(Math, shader.getLayers().map(function (layer) {
            return layer.shader.frames.length;
        }));

        // keep it simple for now and render last step if requested step is bigger than maximum
        if (this.step >= cartoCssOptions.steps) {
            this.step = cartoCssOptions.steps - 1;
        }
    }

    async getTile (format, z, x, y) {
        const timer = new Timer();
        const attrs = Object.assign({ stepSelect: this.step, stepOffset: this.stepOffset }, this.attrs);

        const { buffer: rows, stats } = await this.getTileData(this.sql, { x: x, y: y }, z, this.layer.options.sql, attrs);

        timer.start('render');
        const canvas = createCanvas(this.tile_size, this.tile_size);
        const pointRenderer = new torque.renderer.Point(canvas, this.rendererOptions);
        const renderTile = promisify(pointRenderer.renderTile.bind(pointRenderer));
        const toBuffer = promisify(canvas.toBuffer.bind(canvas));

        await renderTile(this.provider.proccessTile(rows, { x, y }, z), this.step);
        pointRenderer.applyFilters();
        timer.end('render');

        timer.start('encode');
        const buffer = await toBuffer();
        timer.end('encode');

        return { buffer, headers: { 'Content-Type': 'image/png' }, stats: Object.assign(timer.getTimes(), stats) };
    }

    async close () {
        this.canvasImages.forEach(img => {
            // unbind handlers so they don't callback anymore
            img.onerror = null;
            img.onload = null;
            // trick to avoid leak of image buffer
            img.src = null;
        });
        this.canvasImages = [];
    }
};
