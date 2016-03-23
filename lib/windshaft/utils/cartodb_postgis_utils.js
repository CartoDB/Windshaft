'use strict';

function CartoDBPostgisUtils (tileSize, maxGeosize) {
    this.tileSize = tileSize || 256;
    this.tileMaxGeosize = maxGeosize || 40075017; // earth circumference in webmercator 3857
}

module.exports = CartoDBPostgisUtils;

CartoDBPostgisUtils.prototype.cdbXYZResolution = function (z) {
    var full_resolution = this.tileMaxGeosize / this.tileSize;
    return full_resolution / Math.pow(2, z);
};

CartoDBPostgisUtils.prototype.cdbXYZExtent = function (x, y, z) {
    var initial_resolution = this.cdbXYZResolution(0);
    var origin_shift = (initial_resolution * this.tileSize) / 2.0;

    var pixres = initial_resolution / Math.pow(2,z);
    var tile_geo_size = this.tileSize * pixres;

    var xmin = -origin_shift + x*tile_geo_size;
    var xmax = -origin_shift + (x+1)*tile_geo_size;

    var ymin = origin_shift - (y+1)*tile_geo_size;
    var ymax = origin_shift - y*tile_geo_size;

    return {
        xmin: xmin,
        ymin: ymin,
        xmax: xmax,
        ymax: ymax
    };
};
