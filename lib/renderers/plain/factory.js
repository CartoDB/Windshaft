'use strict';

const mapnik = require('@carto/mapnik');
const ColorRenderer = require('./color-renderer');
const ImageRenderer = require('./image-renderer');
const BaseAdaptor = require('../base-adaptor');
const requestImage = require('../http/fetch-image');

module.exports = class PlainFactory {
    static get NAME () {
        return 'plain';
    }

    getName () {
        return PlainFactory.NAME;
    }

    supportsFormat (format) {
        return format === 'png';
    }

    getAdaptor (renderer, onTileErrorStrategy) {
        return new BaseAdaptor(renderer, onTileErrorStrategy);
    }

    getRenderer (mapConfig, format, options, callback) {
        const layerNumber = options.layer;
        const layer = mapConfig.getLayer(layerNumber);

        if (layer.type !== this.getName()) {
            return callback(new Error('Layer is not a \'plain\' layer'));
        }

        const color = layer.options.color;
        const imageUrl = layer.options.imageUrl;

        if (!color && !imageUrl) {
            return callback(new Error('Plain layer: at least one of the options, `color` or `imageUrl`, must be provided.'));
        }

        if (color) {
            colorRenderer(color, layer.options, callback);
        } else if (imageUrl) {
            imageUrlRenderer(imageUrl, layer.options, callback);
        } else {
            return callback(new Error('Plain layer unknown error'));
        }
    }
};

function colorRenderer (color, options, callback) {
    let mapnikColor;

    try {
        if (Array.isArray(color)) {
            if (color.length === 3) {
                mapnikColor = new mapnik.Color(color[0], color[1], color[2]);
            } else if (color.length === 4) {
                mapnikColor = new mapnik.Color(color[0], color[1], color[2], color[3]);
            } else {
                return callback(new Error('Invalid color for \'plain\' layer: invalid integer array'));
            }
        } else {
            mapnikColor = new mapnik.Color(color);
        }
    } catch (err) {
        return callback(new Error(`Invalid color for 'plain' layer: ${err.message}`));
    }

    return callback(null, new ColorRenderer(mapnikColor, options));
}

function imageUrlRenderer (imageUrl, options, callback) {
    const requestOpts = {
        url: imageUrl,
        followRedirect: true,
        encoding: null
    };

    requestImage(requestOpts)
        .then(imageBuffer => callback(null, new ImageRenderer(imageBuffer, options)))
        .catch(err => callback(new Error(`Invalid imageUrl for 'plain' layer: ${err.message}`)));
}
