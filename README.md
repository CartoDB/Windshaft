Windshaft web map tiler
=======================

* RESTful Node.js based webmercator map tiler for PostGIS, wrapping Express, Mapnik & tilelive-mapnik
* Pluggable routing to provide customisable tile API URL endpoints
* Can render all table data, or data restricted by SQL query
* Focussed on high speed generated tiles for single layers. No multi layer or composite support yet.
* Generates image and UTFGrid tiles
* Accepts, stores, serves, and applys map styles written in the Carto markup language (same markup as Mapbox Tilemill)
* Accepts, stores and serves Infowindow information per map layer


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
// The config object must define a base url and a function that adds 'dbname' and 'table'
// variables onto the Express.js req.params object. In this example, the base URL is such that
// dbname and table will automatically be added to the req.params object by express.js.
// req2params can be extended to allow full control over the specifying of dbname and table,
// and also allows for the req.params object to be extended with other variables, such as:
//
// * sql - custom sql query to narrow results shown in map)
// * geom_type - specify the geom type (point|polygon) to get more appropriate default styles
// * cache_buster - forces the creation of a new render object, nullifying existing metatile caches
// * interactivity - specify the column to use in the UTFGrid interactivity layer (defaults to 'id')
//
// the base url is also used for getting and setting styles via the urls:
//
// GET  base_url + '/style' (returns a map style)
// POST base_url + '/style' (allows specifying of a style in Carto markup in the 'style' form variable).
//
var config = {
        base_url: '/database/:dbname/table/:table',
        req2params: function(req, callback){callback(null,req);}
    };

// Initialize tile server on port 4000
var ws = new Windshaft.Server(config);
ws.listen(4000);

// Map tiles are now being served on base_url/:z/:x/:y.*'. Specify .png or .grid.json for image or UTFGrid tiles.
```


Tile Caching
------------
Windshaft serves tiles from a single use metatile cache (from mapnik/tilelive-mapnik). This provides good speed in
addition to keeping the served maps fresh should the underlying data change or be updated. It is not, however, a full caching solution.

Should your data be less dynamic, you may want to consider improving performance by adding a simple HTTP cache such as Varnish infront of the
tile url or your own custom cache implementation.


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
* mapnik
* node-mapnik
* tilelive-mapnik
* Carto
* Thanks to the Mapbox team for making such flexible tools


TODO
-----
* Allow configurable columns and projections
* Allow postgis to be on any host
* ETAG support
* Make simple interface to test map and generate URL to use for your map.
* HOW-TO for a caching HTTP-proxy layer in front of Windshaft
* extend with LRU cache https://github.com/rsms/js-lru/blob/master/lru.js or https://github.com/monsur/jscache/blob/master/cache.js