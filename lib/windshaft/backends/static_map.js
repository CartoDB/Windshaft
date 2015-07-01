var abaculus = require('abaculus');
var SphericalMercator = require('sphericalmercator');
var step = require('step');
var assert = require('assert');

function StaticMapBackend(renderCache, options) {
    this._renderCache = renderCache;
    this._options = options || {};
}

module.exports = StaticMapBackend;


//                         getImage = function(params, width, height, bounds,       callback) {
StaticMapBackend.prototype.getImage = function(params, width, height, zoom, center, callback) {
    if (!callback) {

        callback = center;

        var bounds = zoom;
        zoom = boundsZoom(bounds, {
            width: width,
            height: height
        });
        center = {
            x: bounds.west + Math.abs(bounds.west - bounds.east) / 2,
            y: bounds.south + Math.abs(bounds.south - bounds.north) / 2,
            w: width,
            h: height
        };

    } else {

        center = {
            x: center.lng,
            y: center.lat,
            w: width,
            h: height
        };

    }

    var renderer;

    var format = params.format === 'jpg' ? 'jpeg' : 'png';

    params.format = 'png';
    params.layer = 'all';

    var self = this;

    step(
        function() {
            self._renderCache.getRenderer(params, this);
        },
        function getImage(err, r) {
            assert.ifError(err);
            renderer = r;

            var abaculusParams = {
                zoom: zoom,
                scale: 1, // integer between 1-4 and sets resolution (scale: 1 is 72dpi, scale: 4, is 288dpi)
                center: center,
                format: format,
                getTile: renderer.getTile.bind(renderer),
                limit: (self._options.imageSizeLimit || 8192) + 1
            };

            abaculus(abaculusParams, this);
        },
        function handleImage(err, image, headers, stats) {
            if (renderer) {
                renderer.release();
            }

            return callback(err, image, headers, stats);
        }
    );
};


// Following functionality has been influenced by leaflet's getBoundsZoom
// See http://leafletjs.com/reference.html#map-getboundszoom

var sphericalMercator = new SphericalMercator({
    size: 256
});

function subtract(pointA, pointB) {
    return [
            pointA[0] - pointB[0],
            pointA[1] - pointB[1]
    ];
}

function contains(pointA, pointB) {
    return Math.abs(pointB[0]) <= Math.abs(pointA[0]) && Math.abs(pointB[1]) <= Math.abs(pointA[1]);
}

function boundsZoom(bounds, size) {

    size = [size.width, size.height];

    var se = [bounds.east, bounds.south],
        nw = [bounds.west, bounds.north];

    var zoom = 0,
        maxZoom = 18,
        zoomNotFound = true,
        boundsSize;

    do {
        zoom++;
        boundsSize = subtract(sphericalMercator.px(se, zoom), sphericalMercator.px(nw, zoom));
        zoomNotFound = contains(size, boundsSize);
    } while (zoomNotFound && zoom <= maxZoom);

    return zoom - 1;
}
