var abaculus = require('abaculus');
var SphericalMercator = require('sphericalmercator');
var step = require('step');
var assert = require('assert');

function StaticMapsController(app, renderCache, options) {
    this._app = app;
    this._renderCache = renderCache;
    this._options = options || {};
}

module.exports = StaticMapsController;


StaticMapsController.prototype.register = function(app) {
    app.get(app.base_url_mapconfig + '/static/center/:token/:z/:lat/:lng/:width/:height.:format',
        this.center.bind(this));

    app.get(app.base_url_mapconfig + '/static/bbox/:token/:west,:south,:east,:north/:width/:height.:format',
        this.bbox.bind(this));
};

StaticMapsController.prototype.bbox = function(req, res) {
    var west = +req.params.west,
        south = +req.params.south,
        east = +req.params.east,
        north = +req.params.north,

        width = +req.params.width,
        height = +req.params.height;

    var zoom = boundsZoom(
        {
            nw: [west, north],
            se: [east, south]
        },
        {
            width: width,
            height: height
        }
    );
    this.staticMap(req, res, zoom, {
        x: west + Math.abs(west - east) / 2,
        y: south + Math.abs(south - north) / 2,
        w: width,
        h: height
    });
};

StaticMapsController.prototype.center = function(req, res) {
    this.staticMap(req, res, +req.params.z, {
        x: +req.params.lng,
        y: +req.params.lat,
        w: +req.params.width,
        h: +req.params.height
    });
};

StaticMapsController.prototype.staticMap = function(req, res, zoom, center) {
    this._app.doCORS(res);

    var renderer;

    var format = req.params.format === 'jpg' ? 'jpeg' : 'png';

    req.params.format = 'png';
    req.params.layer = 'all';

    var self = this;

    step(
        function() {
            self._app.req2params(req, this);
        },
        function(err) {
            req.profiler.done('req2params');
            assert.ifError(err);
            self._renderCache.getRenderer(req, this);
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
            req.profiler.done('render-' + format);
            req.profiler.add(stats || {});
            if (renderer) {
                renderer.release();
            }

            if (err) {
                if (!err.error) {
                    err.error = err.message;
                }
                self._app.sendError(res, err, self._app.findStatusCode(err), 'STATIC_MAP', err);
            } else {
                self._app.sendWithHeaders(res, image, 200, headers);
            }
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

    var zoom = 0,
        maxZoom = 18,
        zoomNotFound = true,
        boundsSize;

    do {
        zoom++;
        boundsSize = subtract(sphericalMercator.px(bounds.se, zoom), sphericalMercator.px(bounds.nw, zoom));
        zoomNotFound = contains(size, boundsSize);
    } while (zoomNotFound && zoom <= maxZoom);

    return zoom - 1;
}
