var Renderer = require('./renderer');
var FallbackRenderer = require('./fallback_renderer');

function HttpFactory(whitelist, timeout, proxy, fallbackImage) {
    whitelist = whitelist || [];
    // key => value with urlTemplate => true for quick access
    this.whitelist = whitelist.reduce(function(acc, urlTemplate) {
        acc[urlTemplate] = true;
        return acc;
    }, {});

    this.timeout = timeout;
    this.proxy = proxy;

    this.fallbackImage = fallbackImage;
}

module.exports = HttpFactory;

HttpFactory.prototype.name = 'http';
HttpFactory.prototype.supported_formats = ['png'];

HttpFactory.prototype.getRenderer = function(mapConfig, dbParams, format, layerNumber, callback) {
    var layer = mapConfig.getLayers()[layerNumber];
    var urlTemplate = layer.options.urlTemplate;

    if (layer.type !== this.name) {
        return callback({message: "Layer is not an http layer"});
    }

    if (!isValidUrlTemplate(urlTemplate, this.whitelist)) {
        if (this.fallbackImage) {
            return callback(null, new FallbackRenderer(this.fallbackImage));
        } else {
            return callback({message: "Invalid urlTemplate for http layer"});
        }
    }
    var options = {
        timeout: this.timeout,
        proxy: this.proxy
    };
    return callback(null, new Renderer(urlTemplate, layer.options.subdomains, options));
};

function isValidUrlTemplate(urlTemplate, whitelist) {
    return whitelist[urlTemplate];
}
