var proj4 = require('proj4');
var webmercatorProj = new proj4.Proj('EPSG:3857');

function transform(point, scale) {
    var a = 0.5 / (Math.PI * proj4.WGS84.a),
        b = 0.5,
        c = -a,
        d = b;

    return {
        x: scale * (a * point.x + b),
        y: scale * (c * point.y + d)
    };
}

function project(latlng, zoom) {
    var projectedPoint = proj4(webmercatorProj, proj4.toPoint([latlng.lng, latlng.lat]));
    return transform(projectedPoint, 256 * Math.pow(2, zoom));
}

function subtract(pointA, pointB) {
    return {
        x: pointA.x - pointB.x,
        y: pointA.y - pointB.y
    };
}

function contains(pointA, pointB) {
    return Math.abs(pointB.x) <= Math.abs(pointA.x) && Math.abs(pointB.y) <= Math.abs(pointA.y);
}

function floorPoint(point) {
    return {
        x: Math.floor(point.x),
        y: Math.floor(point.y)
    };
}

function boundsZoom(bounds, size) {

    size = {
        x: size.width,
        y: size.height
    };

    var west = Math.min(bounds.lng1, bounds.lng2),
        south = Math.min(bounds.lat1, bounds.lat2),
        east = Math.max(bounds.lng1, bounds.lng2),
        north = Math.max(bounds.lat1, bounds.lat2),

        zoom = 0,
        maxZoom = 18,

        nw = {lat: north, lng: west},
        se = {lat: south, lng: east},

        zoomNotFound = true,
        boundsSize;

    do {
        zoom++;
        boundsSize = floorPoint(subtract(project(se, zoom), project(nw, zoom)));
        zoomNotFound = contains(size, boundsSize);
    } while (zoomNotFound && zoom <= maxZoom);

    console.log(project(se, zoom-1));
    console.log(project(nw, zoom-1));

    return zoom - 1;
}
console.log(boundsZoom({lat1: 49, lng1: 6, lat2: 52, lng2: 9}, {width: 256, height: 256}));
