module.exports.name             = 'test';
module.exports.postgres         = {user: 'postgres', host: '127.0.0.1', port: 5432, geometry_field: 'the_geom', srid: 4326 };
module.exports.redis            = {host: '127.0.0.1', 
                                   port: 6333, // 6379 is the default
                                   idleTimeoutMillis: 1,
                                   reapIntervalMillis: 1};
module.exports.windshaft_port   = 8083;
module.exports.enable_cors      = true;
