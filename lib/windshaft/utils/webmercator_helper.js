'use strict';

const Decimal = require('decimal.js');

function WebMercatorHelper (tileSize, maxGeosize) {
    this.tileSize = tileSize || 256;
    // 6378137: Earth equatorial radius defined by WGS-84 (webmercator)
    this.tileMaxGeosize = new Decimal(maxGeosize || 6378137.0 * Math.PI * 2);
}

module.exports = WebMercatorHelper;

WebMercatorHelper.prototype.getResolution = function ({ z }) {
    if (z === undefined || !Number.isInteger(z) || z < 0) {
        throw new Error('Input must be a positive integer');
    }
    const full_resolution = this.tileMaxGeosize.dividedBy(this.tileSize);
    return full_resolution.dividedBy(Decimal.pow(2, z));
};

WebMercatorHelper.prototype.getExtent = function ({ x, y, z }) {
    /* jshint maxcomplexity:12 */

    if (x === undefined || !Number.isInteger(x) || x < 0 ||
        y === undefined || !Number.isInteger(y) || y < 0 ||
        z === undefined || !Number.isInteger(z) || z < 0) {
        throw new Error('Inputs must be positive integers');
    }

    const max_coordinate = Decimal.pow(2, z);
    if (x >= max_coordinate || y >= max_coordinate) {
        throw new Error('Invalid tile XYZ (' + x +',' + y + z + ')');
    }

    const origin_shift  = this.tileMaxGeosize.dividedBy(2);
    const tile_geo_size = this.tileMaxGeosize.dividedBy(max_coordinate);

    const xmin = tile_geo_size.times(x).minus(origin_shift);
    const xmax = xmin.plus(tile_geo_size);

    const ymax = origin_shift.minus(tile_geo_size.times(y));
    const ymin = ymax.minus(tile_geo_size);

    return {
        xmin: xmin,
        ymin: ymin,
        xmax: xmax,
        ymax: ymax
    };
};
