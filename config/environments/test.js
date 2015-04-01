module.exports.name = 'test';
// Allowed elements in "postgres" config object:
// user, host, port, geometry_field, srid
module.exports.postgres = {
    geometry_field: 'the_geom',
    srid: 4326
};
module.exports.millstone = {
    cache_basedir: '/tmp/windshaft-test/millstone'
};
module.exports.redis = {
    host: '127.0.0.1',
    port: 6334, // 6379 is the default, 6333 is used by grainstore
    idleTimeoutMillis: 1,
    reapIntervalMillis: 1
};
module.exports.renderer = {
    mapnik: {
        poolSize: 4,//require('os').cpus().length,
        metatile: 1,
        bufferSize: 64,
        snapToGrid: false,
        clipByBox2d: false, // this requires postgis >=2.2 and geos >=3.5
        scale_factors: [1, 2],
        limits: {
            render: 0,
            cacheOnTimeout: true
        }
    },
    http: {
        timeout: 5000,
        whitelist: ['http://127.0.0.1:8033/{s}/{z}/{x}/{y}.png'],
        fallbackImage: {
            type: 'fs',
            src: __dirname + '/../../test/fixtures/http/basemap.png'
        }
    }
};
module.exports.mapnik_version = undefined; // will be looked up at runtime if undefined
module.exports.windshaft_port = 8083;
module.exports.enable_cors = true;
