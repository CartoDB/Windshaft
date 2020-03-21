'use strict';

const { promisify } = require('util');
const mapnik = require('@carto/mapnik');
const imageFromBytes = promisify(mapnik.Image.fromBytes);
const fetchImage = require('./fetch-image');

module.exports = class HttpRenderer {
    constructor (urlTemplate, subdomains, options) {
        this.urlTemplate = urlTemplate;
        this.subdomains = subdomains;

        this.requestOptions = {
            timeout: options.timeout || 2000,
            proxy: options.proxy
        };

        this.tms = options.tms || false;
    }

    async getTile (format, z, x, y) {
        const adjustedY = (this.tms) ? ((1 << z) - y - 1) : y;
        const tileUrl = template(this.urlTemplate, {
            z: z,
            x: x,
            y: adjustedY,
            s: subdomain(x, adjustedY, this.subdomains)
        });
        const requestOpts = {
            url: tileUrl,
            encoding: null,
            followRedirect: true,
            timeout: this.requestOptions.timeout
        };

        if (this.requestOptions.proxy) {
            requestOpts.proxy = this.requestOptions.proxy;
        }

        const { buffer: _buffer, headers, stats } = await fetchImage(requestOpts);
        const buffer = await ensureBufferIs256px(_buffer);

        return { buffer, headers, stats };
    }
};

async function ensureBufferIs256px (buffer) {
    const image = await imageFromBytes(buffer);

    if (image.height() === 256) {
        return buffer;
    }

    const resizedImage = await resizeImage({ image, width: 256, height: 256 });
    const encodedImage = await encodeImage(resizedImage, 'png');

    return encodedImage;
}

const scalingMethod = mapnik.imageScaling.bilinear;

function resizeImage ({ image, width, height }) {
    return new Promise((resolve, reject) => {
        image.premultiply(function () {
            image.resize(width, height, { scaling_method: scalingMethod }, (err, resizedImage) => {
                if (err) {
                    return reject(err);
                }
                return resolve(resizedImage);
            });
        });
    });
};

function encodeImage (image, encoding) {
    return new Promise((resolve, reject) => {
        image.encode(encoding, (err, encodedImage) => {
            if (err) {
                return reject(err);
            }
            return resolve(encodedImage);
        });
    });
}

// Following functionality has been extracted directly from Leaflet library
// License: https://github.com/Leaflet/Leaflet/blob/v0.7.3/LICENSE

// https://github.com/Leaflet/Leaflet/blob/v0.7.3/src/core/Util.js#L107-L117
const templateRe = /\{ *([\w_]+) *\}/g;

// super-simple templating facility, used for TileLayer URLs
function template (str, data) {
    return str.replace(templateRe, function (str, key) {
        var value = data[key];

        if (value === undefined) {
            throw new Error('No value provided for variable ' + str);
        } else if (typeof value === 'function') {
            value = value(data);
        }

        return value;
    });
}

// https://github.com/Leaflet/Leaflet/blob/v0.7.3/src/layer/tile/TileLayer.js#L495-L498
function subdomain (x, y, subdomains) {
    const index = Math.abs(x + y) % subdomains.length;
    return subdomains[index];
}
