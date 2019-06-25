'use strict';

function CartoDBPostgisUtils (tileSize, maxGeosize) {
    this.tileSize = tileSize || 256;
    this.tileMaxGeosize = maxGeosize || 40075017; // earth circumference in webmercator 3857
}

module.exports = CartoDBPostgisUtils;

CartoDBPostgisUtils.prototype.cdbXYZResolution = function (z) {
    const full_resolution = this.tileMaxGeosize / this.tileSize;
    return full_resolution / Math.pow(2, z);
};

CartoDBPostgisUtils.prototype.cdbXYZExtent = function (x, y, z) {
    const origin_shift = this.tileMaxGeosize / 2.0;
    const tile_geo_size = this.tileMaxGeosize / Math.pow(2,z);

    const xmin = -origin_shift + x*tile_geo_size;
    const xmax = xmin + tile_geo_size;

    const ymin = origin_shift - (y+1)*tile_geo_size;
    const ymax = ymin + tile_geo_size;

    return {
        xmin: xmin,
        ymin: ymin,
        xmax: xmax,
        ymax: ymax
    };
};
