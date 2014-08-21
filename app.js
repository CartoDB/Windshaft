var Windshaft = require('./lib/windshaft');
var cluster = require('cluster');
var numCPUs = require('os').cpus().length;
var _          = require('underscore');

// Configure pluggable URLs
// =========================
// The config object must define grainstore config (generally just
// postgres connection details), redis config, a base url and a function
// that adds 'dbname' and 'table' variables onto the Express.js req.params
// object.  In this example, the base URL is such that dbname and table will
// automatically be added to the req.params object by express.js. req2params
// can be extended to allow full control over the specifying of database
// parameters and also allows for the req.params object to be extended with
// other variables, such as:
//
// * sql - custom sql query to narrow results shown in map)
// * geom_type - specify the geom type (point|polygon) to get more
//               appropriate default styles
// * cache_buster - forces the creation of a new render object, nullifying
//                  existing metatile caches
// * interactivity - specify the column to use in the UTFGrid
//                   interactivity layer (defaults to null)
// * style - specify map style in the Carto map language on a per tile basis
//
// * dbuser - username for database connection
// * dbpassword - password for database connection
// * dbhost - database host
// * dbport - database port
// * dbname - database name
//
// the base url is also used for persisiting and retrieving map styles via:
//
// GET  base_url + '/style' (returns a map style)
// POST base_url + '/style' (allows specifying of a style in Carto markup
//                           in the 'style' form variable).
//
// beforeTileRender and afterTileRender could be defined if you want yo
// implement your own tile cache policy. See an example below

var config = {
    base_url: '/database/:dbname/table/:table',
    base_url_notable: '/database/:dbname',
    req2params: function(req, callback){
        // Whitelist query parameters and attach format
        var good_query = ['sql', 'geom_type', 'cache_buster', 'cache_policy', 'callback', 'interactivity', 'map_key', 'api_key', 'auth_token', 'style', 'style_version', 'style_convert', 'config' ];
        var bad_query  = _.difference(_.keys(req.query), good_query);

        _.each(bad_query, function(key){ delete req.query[key]; });
        req.params =  _.extend({}, req.params); // shuffle things as request is a strange array/object
        // bring all query values onto req.params object
        _.extend(req.params, req.query);
        callback(null,req)
    },
    grainstore: {
        datasource: {
            user:'yoan', host: '127.0.0.1',
            port: 5432,
            geometry_field: 'the_geom_webmercator',
            srid: 4326,
            extent: "-20037508.3,-20037508.3,20037508.3,20037508.3",
            //row_limit: 65535,
            //simplify_geometries: true,
            /*
             * Set persist_connection to false if you want
             * database connections to be closed on renderer
             * expiration (1 minute after last use).
             * Setting to true (the default) would never
             * close any connection for the server's lifetime
             */
            persist_connection: false,
            max_size: 500
        }
    }, //see grainstore npm for other options
    renderCache: {
        ttl: 86400000, // milliseconds
    },
    mapnik: {
        metatile: 1,
        bufferSize:32
    },
    redis: {host: '127.0.0.1', port: 6379},
    // this two filters are optional
    beforeTileRender: function(req, res, callback) {
        callback(null);
    },
    afterTileRender: function(req, res, tile, headers, callback) {
        callback(null, tile, headers);
    },
    enable_cors: true
};

if (cluster.isMaster) {
    // Fork workers.
    for (var i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', function(worker, code, signal) {
        console.log('worker ' + worker.process.pid + ' died');
        cluster.fork();
    });
} else {
    var ws = new Windshaft.Server(config);
    ws.listen(4000);

    // Initialize tile server on port 4000

    console.log("map tiles are now being served out of: http://localhost:4000"
        + config.base_url + '/:z/:x/:y.*');

    // Specify .png, .png8 or .grid.json tiles.

}
