var request = require('request');
var Timer = require('../../stats/timer');

function Renderer(urlTemplate, subdomains, options) {
    this.urlTemplate = urlTemplate;
    this.subdomains = subdomains;

    this.requestOptions = {
        timeout: options.timeout || 2000,
        proxy: options.proxy
    };

    this.tms = options.tms || false;
}

module.exports = Renderer;


function requestImage(requestOpts, callback) {
    var timer = new Timer();
    timer.start('render');
    request(requestOpts, function(err, response, buffer) {
        timer.end('render');
        if (err || response.statusCode !== 200) {
            var error = {
                error: 'Unable to fetch http tile',
                url: requestOpts.url
            };
            if (response && response.statusCode) {
                error.statusCode = response.statusCode;
            }
            return callback(error);
        }
        return callback(null, buffer, response.headers, timer.getTimes());
    });
}

module.exports.requestImage = requestImage;


Renderer.prototype.getTile = function(z, x, y, callback) {
    var xy = adjustedXY(z, x, y, this.tms);
    var tileUrl = template(this.urlTemplate, {
        z: z,
        x: xy.x,
        y: xy.y,
        s: subdomain(xy.x, xy.y, this.subdomains)
    });

    var requestOpts = {
        url: tileUrl,
        encoding: null,
        followRedirect: true,
        timeout: this.requestOptions.timeout
    };

    if (this.requestOptions.proxy) {
        requestOpts.proxy = this.requestOptions.proxy;
    }

    return requestImage(requestOpts, callback);
};

function adjustedXY(z, x, y, tms) {
    var limit = Math.pow(2, z);

    return {
        // wrap tile coordinates
        x: ((x % limit) + limit) % limit,
        // invert for tms
        y: (tms) ? (limit - y - 1) : y
    };
}

// Following functionality has been extracted directly from Leaflet library
// License: https://github.com/Leaflet/Leaflet/blob/v0.7.3/LICENSE

// https://github.com/Leaflet/Leaflet/blob/v0.7.3/src/core/Util.js#L107-L117
var templateRe = /\{ *([\w_]+) *\}/g;

// super-simple templating facility, used for TileLayer URLs
function template(str, data) {
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
function subdomain(x, y, subdomains) {
    var index = Math.abs(x + y) % subdomains.length;
    return subdomains[index];
}
