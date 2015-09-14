var _ = require('underscore');

var development = require('./development');
var test = _.extend(development, {
    name: 'test',
    // Allowed elements in "postgres" config object:
    // user, host, port, geometry_field, srid
    postgres: {
        geometry_field: 'the_geom',
        srid: 4326
    },
    millstone: {
        cache_basedir: '/tmp/windshaft-test/millstone'
    },
    redis: _.extend(development.redis, {
        port: 6334 // 6379 is the default, 6333 is used by grainstore
    }),
    renderer: _.extend(development.renderer, {
        http: {
            timeout: 5000,
            whitelist: ['http://127.0.0.1:8033/{s}/{z}/{x}/{y}.png'],
            fallbackImage: {
                type: 'fs',
                src: __dirname + '/../../test/fixtures/http/basemap.png'
            }
        }
    }),
    windshaft_port: 8083
});

module.exports = test;
