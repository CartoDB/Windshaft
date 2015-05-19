var Renderer = require('./renderer');
var BaseAdaptor = require('../base_adaptor');

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
    if (!color) {
        return callback({message: "Invalid color for 'plain' layer"});
    }

    return callback(null, new Renderer(color, layer.options));
};
