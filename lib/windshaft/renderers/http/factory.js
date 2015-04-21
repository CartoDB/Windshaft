var Renderer = require('./renderer');
var FallbackRenderer = require('./fallback_renderer');

function HttpFactory(whitelist, timeout, proxy, fallbackImage) {
    this.whitelist = whitelist || [];

    this.timeout = timeout;
    this.proxy = proxy;

    this.fallbackImage = fallbackImage;
}

module.exports = HttpFactory;

HttpFactory.prototype.name = 'http';
HttpFactory.prototype.supported_formats = ['png'];

HttpFactory.prototype.getRenderer = function(mapConfig, format, options, callback) {
    var layerNumber = options.layer;

    var layer = mapConfig.getLayers()[layerNumber];
    var urlTemplate = layer.options.urlTemplate;

    if (layer.type !== this.name) {
        return callback(new Error('Layer is not an http layer'));
    }

    if (!urlTemplate) {
        return callback(new Error('Missing mandatory "urlTemplate" option'));
    }

    if (!isValidUrlTemplate(urlTemplate, this.whitelist)) {
        if (this.fallbackImage) {
            return callback(null, new FallbackRenderer(this.fallbackImage));
        } else {
            return callback(new Error('Invalid "urlTemplate" for http layer'));
        }
    }

    var subdomains = layer.options.subdomains;
    if (!subdomains) {
        subdomains = urlTemplate.match(/\{ *([s]+) *\}/g) ? ['a', 'b', 'c'] : [];
    }

    var rendererOptions = {
        tms: layer.options.tms || false,
        timeout: this.timeout,
        proxy: this.proxy
    };
    return callback(null, new Renderer(urlTemplate, subdomains, rendererOptions));
};

function isValidUrlTemplate(urlTemplate, whitelist) {
    return whitelist.some(function(currentValue) {
        return urlTemplate === currentValue || urlTemplate.match(currentValue);
    });
}

module.exports.isValidUrlTemplate = isValidUrlTemplate;
