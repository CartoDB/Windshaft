module.exports.name = 'development';
module.exports.postgres = {
    user: 'postgres',
    host: '127.0.0.1',
    port: 5432,
    geometry_field: 'the_geom',
    srid: 4326
};
module.exports.millstone = {
    cache_basedir: '/tmp/windshaft-dev/millstone'
};
module.exports.redis = {
    host: '127.0.0.1',
    port: 6379,
    idleTimeoutMillis: 1,
    reapIntervalMillis: 1
};
module.exports.renderer = {
    mapnik: {
        geometry_field: 'the_geom',
        poolSize: 4,//require('os').cpus().length,
        metatile: 1,
        bufferSize: 64,
        scale_factors: [1, 2],
        limits: {
            render: 0,
            cacheOnTimeout: true
        }
    },
    torque: {
        dbPoolParams: {
            size: 16,
            idleTimeout: 3000,
            reapInterval: 1000
        }
    }
};

module.exports.mapnik_version = '2.3.0'; // will be looked up at runtime if undefined
module.exports.windshaft_port = 8080;
module.exports.enable_cors = true;
