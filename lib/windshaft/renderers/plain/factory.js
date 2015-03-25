var Renderer = require('./renderer');

function PlainFactory() {
}

module.exports = PlainFactory;

PlainFactory.prototype.name = 'plain';
PlainFactory.prototype.supported_formats = ['png'];

PlainFactory.prototype.getRenderer = function(mapConfig, format, options, callback) {
    var layerNumber = options.layer;

    var layer = mapConfig.getLayer(layerNumber);

    if (layer.type !== this.name) {
        return callback({message: "Layer is not a 'plain' layer"});
    }

    var color = layer.options.color;
    if (!color) {
        return callback({message: "Invalid color for 'plain' layer"});
    }

    return callback(null, new Renderer(color, layer.options));
};
