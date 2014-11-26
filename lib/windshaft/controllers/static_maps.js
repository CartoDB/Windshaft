var abaculus    = require('abaculus'),
    request     = require('request'),
    Step        = require('step');

function StaticMapsController(app, renderCacche) {
    this._app = app;
    this._renderCache = renderCacche;
}

module.exports = StaticMapsController;


StaticMapsController.prototype.register = function(app) {
    app.get(app.base_url_mapconfig + '/static/center/:token/:z/:lat/:lng/:width/:height.:format', this.center.bind(this));
    app.get(app.base_url_mapconfig + '/static/bbox/:token/:lat1/:lng1/:lat2/:lng2/:width/:height.:format', this.bbox.bind(this));
};

StaticMapsController.prototype.bbox = function(req, res) {
    this._app.doCORS(res);

    var self = this;
    var renderer;
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

            var west = Math.min(+req.params.lng1, +req.params.lng2),
                south = Math.min(+req.params.lat1, +req.params.lat2),
                east = Math.max(+req.params.lng1, +req.params.lng2),
                north = Math.max(+req.params.lat1, +req.params.lat2);

            var abaculusParams = {
                zoom: 4,
                scale: 1, // integer between 1-4 and sets resolution (scale: 1 is 72dpi, scale: 4, is 288dpi)
                bbox: [west, south, east, north],
                format: req.params.format,
                getTile: function(z, x, y, callback) {
                    renderer.getTile(z, x, y, function(err, tile, headers) {
                        if (err) throw err;
                        return callback(null, tile, headers);
                    });
                },
                limit: 4096
            };

            abaculus(abaculusParams, function(err, image, headers) {
                if (err) return err;
                self._app.sendWithHeaders(res, image, 200, headers);
            });
        }
    );
};

StaticMapsController.prototype.center = function(req, res) {
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

            var abaculusParams = {
                zoom: +req.params.z,
                scale: 1, // integer between 1-4 and sets resolution (scale: 1 is 72dpi, scale: 4, is 288dpi)
                center: {
                    x: +req.params.lng,
                    y: +req.params.lat,
                    w: +req.params.width,
                    h: +req.params.height
                },
                format: format,
                getTile: [
                    function(z, x, y, callback) {
                        var requestOpts = {
                            url: 'http://tile.stamen.com/toner/' + z + '/' + x + '/' + y + '.png',
                            encoding: null
                        };
                        request(requestOpts, function(err, response, buffer) {
                            if (err) {
                                return callback(err);
                            }
                            return callback(null, buffer, response.headers);
                        });
                    },
                    function(z, x, y, callback) {
                        renderer.getTile(z, x, y, function(err, tile, headers) {
                            if (err) throw err;
                            return callback(null, tile, headers);
                        });
                    }

                ],
                limit: 4096
            };

            abaculus(abaculusParams, function(err, image, headers) {
                if (err) return err;
                self._app.sendWithHeaders(res, image, 200, headers);
            });
        }
    );
};
