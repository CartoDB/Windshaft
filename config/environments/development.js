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
        },
        geojson: {
            dbPoolParams: {
                  // maximum number of resources to create at any given time
                  size: 16,
                  // max milliseconds a resource can go unused before it should be destroyed
                  idleTimeout: 3000,
                  // frequency to check for idle resources
                  reapInterval: 1000
            },

            // SQL queries will be wrapped with ST_ClipByBox2D
            // Returning the portion of a geometry falling within a rectangle
            // It will only work if snapToGrid is enabled
            clipByBox2d: false, // this requires postgis >=2.2 and geos >=3.5
            // geometries will be simplified using ST_RemoveRepeatedPoints
            // which cost is no more expensive than snapping and results are
            // much closer to the original geometry
            removeRepeatedPoints: false // this requires postgis >=2.2
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
module.exports.mapnik_version = '3.0.12'; // will be looked up at runtime if undefined
module.exports.windshaft_port = 8080;
module.exports.enable_cors = true;
module.exports.enabledFeatures = {
    // whether in mapconfig is available stats & metadata for each layer
    layerMetadata: false
};
