'use strict';

const { preview } = require('@carto/cartonik');
const pngToJpeg = require('png-to-jpeg');

module.exports = class PreviewBackend {
    constructor (rendererCache, options = {}) {
        this._rendererCache = rendererCache;
        this._options = options;
    }

    getImage (options, callback) {
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
                // We request it in PNG as conversion is handled in the next step
                format: 'png',
                getTile: renderer.getTile.bind(renderer),
                limit: (this._options.imageSizeLimit || 8192) + 1,
                concurrency: this._options.concurrency
            };

            preview(options)
                .then(({ image, stats }) => {
                    if (format === 'jpg' || format === 'jpeg') {
                        // Conversion to jpg is not working correctly at Mapnik level,
                        // so we request the image in png and we convert it at this point
                        return pngToJpeg({ quality: 85 })(image)
                            .then(outputImage => callback(null, outputImage, stats));
                    }
                    callback(null, image, stats);
                })
                .catch((err) => callback(err))
                .finally(() => renderer.release());
        });
    }
};
