var mapnik = require('mapnik');
var ColorRenderer = require('./color_renderer');
var ImageRenderer = require('./image_renderer');
var BaseAdaptor = require('../base_adaptor');

var requestImage = require('../http/renderer').requestImage;

function PlainFactory() {
}

module.exports = PlainFactory;

PlainFactory.prototype.getName = function() {
    return 'plain';
};

PlainFactory.prototype.supportsFormat = function(format) {
    return format === 'png';
};

PlainFactory.prototype.getAdaptor = function(renderer, format, onTileErrorStrategy) {
    return new BaseAdaptor(renderer, format, onTileErrorStrategy);
};

PlainFactory.prototype.getRenderer = function(mapConfig, format, options, callback) {
    var layerNumber = options.layer;

    var layer = mapConfig.getLayer(layerNumber);

    if (layer.type !== this.getName()) {
        return callback({message: "Layer is not a 'plain' layer"});
    }

    var color = layer.options.color;
    var imageUrl = layer.options.imageUrl;

    if (!color && !imageUrl) {
        return callback({
            message: "Plain layer: at least one of the options, `color` or `imageUrl`, must be provided."
        });
    }

    if (color) {
        colorRenderer(color, layer.options, callback);
    } else if (imageUrl) {
        imageUrlRenderer(imageUrl, layer.options, callback);
    } else {
        return callback(new Error('Plain layer unknown error'));
    }
};

function colorRenderer(color, options, callback) {
    var mapnikColor;
    try {
        if (Array.isArray(color)) {
            if (color.length === 3) {
                mapnikColor = new mapnik.Color(color[0], color[1], color[2]);
            } else if (color.length === 4) {
                mapnikColor = new mapnik.Color(color[0], color[1], color[2], color[3]);
            } else {
                return callback(new Error("Invalid color for 'plain' layer: invalid integer array"));
            }
        } else {
            mapnikColor = new mapnik.Color(color);
        }
    } catch (err) {
        return callback(new Error("Invalid color for 'plain' layer: " + err.message));
    }
    return callback(null, new ColorRenderer(mapnikColor, options));
}

function imageUrlRenderer(imageUrl, options, callback) {
    var requestOpts = {
        url: imageUrl,
        followRedirect: true,
        encoding: null
    };

    requestImage(requestOpts, function(err, imageBuffer) {
        if (err) {
            return callback(new Error("Invalid imageUrl for 'plain' layer: " + err.message));
        }
        return callback(null, new ImageRenderer(imageBuffer, options));
    });
}
