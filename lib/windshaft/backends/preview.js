'use strict';

var abaculus = require('abaculus');
var SphericalMercator = require('sphericalmercator');

function PreviewBackend(rendererCache, options) {
    this._rendererCache = rendererCache;
    this._options = options || {};
}

module.exports = PreviewBackend;


//                       getImage = function(mapConfigProvider, format, width, height, bounds,       callback) {
PreviewBackend.prototype.getImage = function(mapConfigProvider, format, width, height, zoom, center, callback) {
    if (!callback) {

        callback = center;

        var bounds = zoom;
        zoom = boundsZoom(bounds, {
            width: width,
            height: height
        });
        center = {
            x: bounds.west + Math.abs(bounds.west - bounds.east) / 2,
            y: bounds.south + Math.abs(bounds.south - bounds.north) / 2
        };

    } else {

        center = {
            x: center.lng,
            y: center.lat
        };

    }

    this._rendererCache.getRenderer(mapConfigProvider, (err, renderer) => {
        if (err) {
            if (renderer) {
                renderer.release();
            }

            return callback(err);
        }

        const abaculusParams = {
            zoom: zoom,
            scale: 1, // integer between 1-4 and sets resolution (scale: 1 is 72dpi, scale: 4, is 288dpi)
            center: center,
            dimensions: { width, height },
            format: format,
            getTile: renderer.getTile.bind(renderer),
            limit: (this._options.imageSizeLimit || 8192) + 1
        };

        blend(abaculusParams)
            .then(({ image, stats }) => callback(null, image, stats))
            .catch((err) => callback(err))
            .finally(() => renderer.release());
    });
};


async function blend (options) { // jshint ignore:line
    try {
        const { image, stats } = await abaculus(options); // jshint ignore:line
        return { image, stats };
    } catch (err) {
        throw err;
    }
}



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
