var abaculus = require('abaculus'),
    request = require('request'),
    SphericalMercator = require('sphericalmercator'),
    Step = require('step');

function StaticMapsController(app, renderCache, mapStore, options) {
    this._app = app;
    this._renderCache = renderCache;
    this._mapStore = mapStore;
    this._options = options || {};
}

module.exports = StaticMapsController;


StaticMapsController.prototype.register = function(app) {
    app.get(app.base_url_mapconfig + '/static/center/:token/:z/:lat/:lng/:width/:height.:format', this.center.bind(this));
    app.get(app.base_url_mapconfig + '/static/bbox/:token/:lat1/:lng1/:lat2/:lng2/:width/:height.:format', this.bbox.bind(this));
};

StaticMapsController.prototype.bbox = function(req, res) {
    var west = Math.min(+req.params.lng1, +req.params.lng2),
        south = Math.min(+req.params.lat1, +req.params.lat2),
        east = Math.max(+req.params.lng1, +req.params.lng2),
        north = Math.max(+req.params.lat1, +req.params.lat2),

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

    var format = req.params.format == 'jpg' ? 'jpeg' : 'png';

    req.params.format = 'png';

    var self = this;

    Step(
        function() {
            self._app.req2params(req, this);
        },
        function(err) {
            if (err) throw err;
            self._renderCache.getRenderer(req, this);
        },
        function(err, r) {
            renderer = r;
            if (err) throw err;

            self._mapStore.load(req.params.token, this);
        },
        function(err, mapConfig) {
            if (err) throw err;

            var basemapGetTiles = mapConfig.getLayers()
                .filter(function(httpLayer) {
                    return httpLayer.type === 'http';
                })
                .map(function(httpLayer) {
                    return function(z, x, y, callback) {
                        var tileUrl = template(httpLayer.options.urlTemplate, {
                            z: z,
                            x: x,
                            y: y,
                            s: subdomain(x, y, httpLayer.options.subdomains)
                        });

                        var requestOpts = {
                            url: tileUrl,
                            timeout: 2000,
                            encoding: null
                        };
                        request(requestOpts, function(err, response, buffer) {
                            if (err || response.statusCode !== 200) {
                                var error = {
                                    error: 'Unable to fetch http tile',
                                    url: tileUrl
                                };
                                if (response && response.statusCode) {
                                    error.statusCode = response.statusCode;
                                }
                                return callback(error);
                            }
                            return callback(null, buffer, response.headers);
                        });
                    };
                });

            var getTiles = basemapGetTiles.concat(function(z, x, y, callback) {
                renderer.getTile(z, x, y, function(err, tile, headers) {
                    if (err) throw err;
                    return callback(null, tile, headers);
                });
            });

            var abaculusParams = {
                zoom: zoom,
                scale: 1, // integer between 1-4 and sets resolution (scale: 1 is 72dpi, scale: 4, is 288dpi)
                center: center,
                format: format,
                getTile: getTiles,
                limit: (self._options.imageSizeLimit || 8192) + 1
            };

            abaculus(abaculusParams, this);
        },
        function handleImage(err, image, headers) {
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


// Following functionality has been extracted directly from Leaflet library
// License: https://github.com/Leaflet/Leaflet/blob/v0.7.3/LICENSE

// https://github.com/Leaflet/Leaflet/blob/v0.7.3/src/core/Util.js#L107-L117
var templateRe = /\{ *([\w_]+) *\}/g;

// super-simple templating facility, used for TileLayer URLs
function template(str, data) {
    return str.replace(templateRe, function (str, key) {
        var value = data[key];

        if (value === undefined) {
            throw new Error('No value provided for variable ' + str);

        } else if (typeof value === 'function') {
            value = value(data);
        }
        return value;
    });
}


// https://github.com/Leaflet/Leaflet/blob/v0.7.3/src/layer/tile/TileLayer.js#L495-L498
function subdomain(x, y, subdomains) {
    var index = Math.abs(x + y) % subdomains.length;
    return subdomains[index];
}
