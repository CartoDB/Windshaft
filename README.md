Windshaft map tiler
===================

[![Build Status](https://travis-ci.org/CartoDB/Windshaft.png)](http://travis-ci.org/CartoDB/Windshaft)

A Node.js based webmercator map tile server for PostGIS with Carto map
styling API.

* Pluggable routing to provide customizable tile API URL endpoints
* Before and after filters to allow custom access control and caching
  strategies
* Can render arbitrary SQL queries 
* Generates image and UTFGrid interactivity tiles
* Accepts, stores, serves, and applies map styles written in the Carto
  markup language (same markup as Mapbox Tilemill)
* Accepts custom map styles on a per tile basis in the tile request
* Allows setting of CORS headers to allow access to tile data from
  Javascript

![Puma Concolor by @eightysteele] (
http://github.com/Vizzuality/Windshaft/raw/master/examples/puma_concolor.png
)

Being a dynamic map renderer, windshaft commits some map server 'sins' in
its raw form. The idea is that you the developer will want to graft your
own auth/metrics/caching/scaling on top of decent core components. Same
old story: high cohesion, low coupling makes us happy.

Windshaft is a library used by cartodb.com,
an Open Source Geospatial Database on the Cloud.

Dependencies
------------
* Node 0.6+ & npm 1.1.2+ (for shrinkwrap support)
* Mapnik 2.0.1, 2.0.2 or 2.1.0 (http://github.com/mapnik/mapnik-reference)
* PostgreSQL >8.3.x, PostGIS >1.5.x
* Redis >2.2.x


Install
-------
```
npm install
```


Usage
-----
```javascript

var Windshaft = require('windshaft');

// Configure pluggable URLs
// =========================
// The config object must define grainstore config (generally just
// postgres connection details), redis config, a base url and a function
// that adds 'dbname' and 'table' variables onto the Express.js req.params
// object.  In this example, the base URL is such that dbname and table will
// automatically be added to the req.params object by express.js. req2params
// can be extended to allow full control over the specifying of dbname and
// table, and also allows for the req.params object to be extended with
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
        req2params: function(req, callback){
          callback(null,req)
        },
        grainstore: {
          datasource: {
            user:'postgres', host: '127.0.0.1',
        		port: 5432
          }
        }, //see grainstore npm for other options
        renderCache: {
          ttl: 60000, // seconds
        },
        mapnik: {
          metatile: 4,
          bufferSize:64
        },
        redis: {host: '127.0.0.1', port: 6379},
        // this two filters are optional
        beforeTileRender: function(req, res, callback) {
            callback(null);
        },
        afterTileRender: function(req, res, tile, headers, callback) {
            callback(null, tile, headers);
        }
    };

// Initialize tile server on port 4000
var ws = new Windshaft.Server(config);
ws.listen(4000);
console.log("map tiles are now being served out of: http://localhost:4000"
            + config.base_url + '/:z/:x/:y.*');

// Specify .png, .png8 or .grid.json tiles.
```

See examples directory for running server and maptile viewer


Installing Mapnik
-----------------

**Source**
https://github.com/mapnik/mapnik/downloads

**OSX**

http://trac.mapnik.org/wiki/MacInstallation/Homebrew

**Linux**

There should be .deb packages out there with stable 2.0.0 packages right now.
Search fro libmapnik2-dev

Tests
-----

Windshaft has a unit and acceptance test suite.
To execute them, run ```make check``` (or ```npm test```).
It is also possible for tests to recurse into some of
the submodules, that's done with ```make check-submodules```
(or ```make check-full``` to run both)

Troubleshooting
---------------

### Postgres errors persist after configuration change

If you're seeing Postgres errors that you can't dispel through changes in your
Windshaft config (e.g. `ERROR: column "the_geom_webmercator" does not exist`),
try `redis-cli flushall`. Windshaft caches MML files in Redis than can contain SQL
and may not expire them when you change your Windshaft config, but manually flushing 
redis should do the trick.

--
Thanks to the Mapnik and Mapbox team for making such flexible tools


