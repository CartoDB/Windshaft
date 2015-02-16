var Renderer = require('./renderer');

function PlainFactory() {
}

module.exports = PlainFactory;

PlainFactory.prototype.name = 'plain';
PlainFactory.prototype.supported_formats = ['png'];

PlainFactory.prototype.getRenderer = function(mapConfig, dbParams, format, layerNumber, callback) {
    var layer = mapConfig.getLayers()[layerNumber];
    var color = layer.options.color;

    if (layer.type !== this.name) {
        return callback({message: "Layer is not a 'plain' layer"});
    }

    if (!color) {
        return callback({message: "Invalid color for 'plain' layer"});
    }

    return callback(null, new Renderer(color, layer.options));
};
