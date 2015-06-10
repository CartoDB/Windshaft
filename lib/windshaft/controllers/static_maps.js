var step = require('step');
var assert = require('assert');

function StaticMapsController(app, staticMapBackend) {
    this._app = app;
    this._staticMapBackend = staticMapBackend;
}

module.exports = StaticMapsController;


StaticMapsController.prototype.register = function(app) {
    app.get(app.base_url_mapconfig + '/static/center/:token/:z/:lat/:lng/:width/:height.:format',
        this.center.bind(this));

    app.get(app.base_url_mapconfig + '/static/bbox/:token/:west,:south,:east,:north/:width/:height.:format',
        this.bbox.bind(this));
};

StaticMapsController.prototype.bbox = function(req, res) {
    this.staticMap(req, res, +req.params.width, +req.params.height, {
        west: +req.params.west,
        north: +req.params.north,
        east: +req.params.east,
        south: +req.params.south
    });
};

StaticMapsController.prototype.center = function(req, res) {
    this.staticMap(req, res, +req.params.width, +req.params.height, +req.params.z, {
        lng: +req.params.lng,
        lat: +req.params.lat
    });
};

StaticMapsController.prototype.staticMap = function(req, res, width, height, zoom /* bounds */, center) {
    this._app.doCORS(res);

    var format = req.params.format === 'jpg' ? 'jpeg' : 'png';

    var self = this;

    step(
        function() {
            self._app.req2params(req, this);
        },
        function(err) {
            req.profiler.done('req2params');
            assert.ifError(err);
            if (center) {
                self._staticMapBackend.getImage(req, width, height, zoom, center, this);
            } else {
                self._staticMapBackend.getImage(req, width, height, zoom /* bounds */, this);
            }
        },
        function handleImage(err, image, headers, stats) {
            req.profiler.done('render-' + format);
            req.profiler.add(stats || {});

            if (err) {
                if (!err.error) {
                    err.error = err.message;
                }
                self._app.sendError(res, {errors: ['' + err] }, self._app.findStatusCode(err), 'STATIC_MAP', err);
            } else {
                res.setHeader('Content-Type', headers['Content-Type'] || 'image/' + format);
                self._app.sendResponse(res, [image, 200]);
            }
        }
    );
};
