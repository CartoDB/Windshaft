var step = require('step');
var assert = require('assert');
var windshaft = require('../../../lib/windshaft');

var MapStoreMapConfigProvider = windshaft.model.provider.MapStoreMapConfig;

/**
 *
 * @param app
 * @param {MapStore} mapStore
 * @param {PreviewBackend} previewBackend
 * @constructor
 */
function StaticMapsController(app, mapStore, previewBackend) {
    this._app = app;
    this.mapStore = mapStore;
    this.previewBackend = previewBackend;
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
    req.params.format = 'png';
    req.params.layer = 'all';

    var self = this;

    step(
        function() {
            self._app.req2params(req, this);
        },
        function(err) {
            assert.ifError(err);
            var mapConfigProvider = new MapStoreMapConfigProvider(self.mapStore, req.params);
            var options = { mapConfigProvider, format, width, height, zoom, center, bbox };

            self.previewBackend.getImage(options), this);
        },
        function handleImage(err, image, headers) {
            if (err) {
                if (!err.error) {
                    err.error = err.message;
                }
                self._app.sendError(res, {errors: ['' + err] }, self._app.findStatusCode(err), 'STATIC_MAP', err);
            } else {
                res.setHeader('Content-Type', headers['Content-Type'] || 'image/' + format);
                res.send(image, 200);
            }
        }
    );
};
