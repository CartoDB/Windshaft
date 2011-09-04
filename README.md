Windshaft web map tiler
=======================

A Node.js based webmercator map tile server for PostGIS with Carto map styling API.

* Pluggable routing to provide customisable tile API URL endpoints
* Can render all table data, or data restricted by SQL query
* Generates image and UTFGrid tiles
* Accepts, stores, serves, and applys map styles written in the Carto markup language (same markup as Mapbox Tilemill)
* Accepts, stores and serves Infowindow information per map layer
* limited caching, focus on handling concurrent renders
* No multi layer or composite support yet


Dependencies
------------
* Node 0.4.x & npm
* Mapnik 2.0 or trunk > r3126
* PostgreSQL >8.3.x, PostGIS >1.5.x
* Redis >2.2.x


Install
-------
```
npm install windshaft
```


Usage
-----
```javascript

var Windshaft = require('windshaft');

// Configure pluggable URLs
// =========================
// The config object must define grainstore config (generally just postgres connection details), redis config,
// a base url and a function that adds 'dbname' and 'table' variables onto the Express.js req.params object.
// In this example, the base URL is such that dbname and table will automatically be added to the req.params
// object by express.js. req2params can be extended to allow full control over the specifying of dbname and table,
// and also allows for the req.params object to be extended with other variables, such as:
//
// * sql - custom sql query to narrow results shown in map)
// * geom_type - specify the geom type (point|polygon) to get more appropriate default styles
// * cache_buster - forces the creation of a new render object, nullifying existing metatile caches
// * interactivity - specify the column to use in the UTFGrid interactivity layer (defaults to null)
//
// the base url is also used for getting and setting styles via the urls:
//
// GET  base_url + '/style' (returns a map style)
// POST base_url + '/style' (allows specifying of a style in Carto markup in the 'style' form variable).
//
var config = {
        base_url: '/database/:dbname/table/:table',
        req2params: function(req, callback){callback(null,req)},
        grainstore: {datasource: {user:'postgres', host: '127.0.0.1', port: 5432}}, //see grainstore npm for other options
        redis: {host: '127.0.0.1', port: 6379}
    };

// Initialize tile server on port 4000
var ws = new Windshaft.Server(config);
ws.listen(4000);
console.log("map tiles are now being served out of: http://localhost:4000" + config.base_url + '/:z/:x/:y.*');

// Specify .png, .png8 or .grid.json tiles.
```

See examples directory for running server and maptile viewer

Tile Caching
------------
Windshaft serves tiles from a single use metatile cache (from mapnik/tilelive-mapnik). This provides good speed in
addition to keeping the served maps fresh should the underlying data change or be updated. It is not, however, a full caching solution.

Should your data be less dynamic, you may want to consider improving performance by adding a simple HTTP cache such as Varnish infront of the
tile url or your own custom cache implementation. Also, see notes below on caching


Concurrency
------------
Windshaft uses node.js and tilelive-mapnik's built in evented request handlig, queuing and pooling to provide excellent scalability under concurrent requests.
Should render load get too high, you may like split load over loadbalancers.


Limitations
-----------
* supports single layer render only.
* for speed, expects geometry projected to webmercator (EPSG:3857) in a column called the_geom_webmercator.
* limited to localhost based postgis installations.

These will be configurable in future versions.


Credits
--------
* Thanks to the Mapnik and Mapbox team for making such flexible tools


TODO
-----
* remove all cartoDB references and split into separate lib
* release npm
* Make simple interface to test map and generate URL to use for your map.
* HOW-TO for a caching HTTP-proxy layer in front of Windshaft
* limit total number of renderers that can be made (LRU?)
* make test fixtures

Notes on Caching
-----------------
Consider at least 3 different types of cache:

* Map config and setup (style, interactivity etc). Cache the renderer or Mapnik XML. Invalidation requires knowledge of changes in config or style. (done)
* Serverside caching of generated map tiles cached in LRU or other. Other than simple TTL, Invalidation requires knowledge of changes in map style *or* underlying data.
* Clientside caching by ETag. Requires server to manage ETags per tile and invalidate when style *or* data changes. See serverside caching.

In the case of invalidation caused by data changes, flushing only tiles in the area edited and up their zoom stack is desirable rather than global flush.
Microsoft Quadkeys are a one-dimensional index key that also  encodes properties (zoom level and parent tile) that would aid this style of invalidation. http://msdn.microsoft.com/en-us/library/bb259689.aspx

mini JS LRU cache: https://github.com/rsms/js-lru/blob/master/lru.js or https://github.com/monsur/jscache/blob/master/cache.js.Clear LRU without global puge and maintain access speed. 1 LRU per renderer?