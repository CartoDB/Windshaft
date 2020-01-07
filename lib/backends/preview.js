'use strict';

const { preview } = require('@carto/cartonik');

function PreviewBackend (rendererCache, options) {
    this._rendererCache = rendererCache;
    this._options = options || {};
}

module.exports = PreviewBackend;

PreviewBackend.prototype.getImage = function (options, callback) {
    const { mapConfigProvider, format, width, height, zoom, center, bbox } = options;

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
            limit: (this._options.imageSizeLimit || 8192) + 1,
            concurrency: this._options.concurrency
        };

        preview(options)
            .then(({ image, stats }) => callback(null, image, stats))
            .catch((err) => callback(err))
            .finally(() => renderer.release());
    });
};
