const path = require('path');
const mapnik = require('@carto/mapnik');

mapnik.register_system_fonts();
mapnik.register_default_fonts();

module.exports = {
    name: 'test',
    mapnik_version: undefined,
    postgres: {
        geometry_field: 'the_geom',
        srid: 4326
    },
    millstone: {
        cache_basedir: '/tmp/windshaft-test/millstone'
    },
    redis: {
        host: '127.0.0.1',
        port: 6334,
        idleTimeoutMillis: 1,
        reapIntervalMillis: 1
    },
    renderer: {
        mapnik: {
            grainstore: {
                carto_env: {
                    validation_data: {
                        fonts: Object.keys(mapnik.fontFiles())
                    }
                },
                datasource: {
                    geometry_field: 'the_geom',
                    srid: 4326
                },
                cachedir: '/tmp/windshaft-test/millstone',
                mapnik_version: mapnik.versions.mapnik
            },
            mapnik: {
                geometry_field: 'the_geom',
                poolSize: 4,
                poolMaxWaitingClients: 16,
                metatile: 1,
                bufferSize: 64,
                scale_factors: [1, 2],
                limits: {
                    render: 0,
                    cacheOnTimeout: true
                },
                geojson: {
                    dbPoolParams: {
                        size: 16,
                        idleTimeout: 3000,
                        reapInterval: 1000
                    },
                    clipByBox2d: false,
                    removeRepeatedPoints: false
                },
                'cache-features': true,
                metrics: false,
                markers_symbolizer_caches: {
                    disabled: false
                }
            }
        },
        torque: {
            dbPoolParams: {
                size: 16,
                idleTimeout: 3000,
                reapInterval: 1000
            }
        },
        http: {
            timeout: 5000,
            whitelist: ['http://127.0.0.1:8033/{s}/{z}/{x}/{y}.png'],
            fallbackImage: {
                type: 'fs',
                src: path.join(__dirname, '../test/fixtures/http/basemap.png')
            }
        }
    }
};
