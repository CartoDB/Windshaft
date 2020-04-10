'use strict';

const Renderer = require('./renderer');
const FallbackRenderer = require('./fallback-renderer');
const BaseAdaptor = require('../base-adaptor');

module.exports = class HttpFactory {
    static get NAME () {
        return 'http';
    }

    static isValidUrlTemplate (urlTemplate, whitelist) {
        return whitelist.some((currentValue) => {
            return urlTemplate === currentValue || urlTemplate.match(currentValue);
        });
    }

    constructor (options = {}) {
        this.whitelist = options.whitelist || [];
        this.timeout = options.timeout;
        this.proxy = options.proxy;
        this.fallbackImage = options.fallbackImage;
    }

    getName () {
        return HttpFactory.NAME;
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
        const urlTemplate = layer.options.urlTemplate;

        if (layer.type !== this.getName()) {
            return callback(new Error('Layer is not an http layer'));
        }

        if (!urlTemplate) {
            return callback(new Error('Missing mandatory "urlTemplate" option'));
        }

        if (!HttpFactory.isValidUrlTemplate(urlTemplate, this.whitelist)) {
            if (this.fallbackImage) {
                return callback(null, new FallbackRenderer(this.fallbackImage));
            } else {
                return callback(new Error('Invalid "urlTemplate" for http layer'));
            }
        }

        const subdomains = getSubdomains(urlTemplate, layer.options);
        const rendererOptions = {
            tms: layer.options.tms || false,
            timeout: this.timeout,
            proxy: this.proxy
        };

        return callback(null, new Renderer(urlTemplate, subdomains, rendererOptions));
    }
};

function getSubdomains (urlTemplate, options) {
    var subdomains = options.subdomains;

    if (!subdomains) {
        subdomains = urlTemplate.match(/\{ *([s]+) *\}/g) ? ['a', 'b', 'c'] : [];
    }

    return subdomains;
}
