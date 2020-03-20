'use strict';

var Renderer = require('./renderer');
var FallbackRenderer = require('./fallback-renderer');
var BaseAdaptor = require('../base-adaptor');

function HttpFactory (whitelist, timeout, proxy, fallbackImage) {
    this.whitelist = whitelist || [];

    this.timeout = timeout;
    this.proxy = proxy;

    this.fallbackImage = fallbackImage;
}

module.exports = HttpFactory;
const NAME = 'http';
module.exports.NAME = NAME;

HttpFactory.prototype.getName = function () {
    return NAME;
};

HttpFactory.prototype.supportsFormat = function (format) {
    return format === 'png';
};

HttpFactory.prototype.getAdaptor = function (renderer, onTileErrorStrategy) {
    return new BaseAdaptor(renderer, onTileErrorStrategy);
};

HttpFactory.prototype.getRenderer = function (mapConfig, format, options, callback) {
    var layerNumber = options.layer;

    var layer = mapConfig.getLayer(layerNumber);
    var urlTemplate = layer.options.urlTemplate;

    if (layer.type !== this.getName()) {
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

    var subdomains = getSubdomains(urlTemplate, layer.options);

    var rendererOptions = {
        tms: layer.options.tms || false,
        timeout: this.timeout,
        proxy: this.proxy
    };
    return callback(null, new Renderer(urlTemplate, subdomains, rendererOptions));
};

function getSubdomains (urlTemplate, options) {
    var subdomains = options.subdomains;

    if (!subdomains) {
        subdomains = urlTemplate.match(/\{ *([s]+) *\}/g) ? ['a', 'b', 'c'] : [];
    }

    return subdomains;
}

function isValidUrlTemplate (urlTemplate, whitelist) {
    return whitelist.some(function (currentValue) {
        return urlTemplate === currentValue || urlTemplate.match(currentValue);
    });
}

module.exports.isValidUrlTemplate = isValidUrlTemplate;
