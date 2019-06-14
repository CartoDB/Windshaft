'use strict';

const { preview } = require('@carto/cartonik');

function PreviewBackend(rendererCache, options) {
    this._rendererCache = rendererCache;
    this._options = options || {};
}

module.exports = PreviewBackend;

//                       getImage = function(mapConfigProvider, format, width, height, bbox,       callback) {
PreviewBackend.prototype.getImage = function(mapConfigProvider, format, width, height, zoom, center, callback) {
    var bbox;

    if (!callback && typeof center === 'function') {
        bbox = zoom;
        zoom = undefined;
        callback = center;
        center = undefined;
    }

    this._rendererCache.getRenderer(mapConfigProvider, (err, renderer) => {
        if (err) {
            if (renderer) {
                renderer.release();
            }

            return callback(err);
        }

        const options = {
            zoom: zoom,
            scale: 1,
            center: center,
            dimensions: { width, height },
            bbox: bbox,
            format: format,
            getTile: renderer.getTile.bind(renderer),
            limit: (this._options.imageSizeLimit || 8192) + 1
        };

        preview(options)
            .then(({ image, stats }) => callback(null, image, stats))
            .catch((err) => callback(err))
            .finally(() => renderer.release());
    });
};
