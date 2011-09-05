Windshaft map tiler
===================

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


Notes on installing Mapnik 2.0 in Ubuntu
-----------------------------------------

Easy way
```
sudo apt-get install build-essential curl wget
sudo add-apt-repository ppa:mapnik/nightly-trunk
sudo apt-get update
sudo apt-get install libmapnik2 libmapnik2-dev mapnik2-utils
```

Harder but stable way
```
sudo apt-get install build-essential curl wget
wget https://launchpad.net/~mapnik/+archive/nightly-trunk/+files/libmapnik2-dev_2%2Bdev20110905.svn3272-1~lucid1_amd64.deb (or i386)
wget https://launchpad.net/~mapnik/+archive/nightly-trunk/+files/libmapnik2_2%2Bdev20110905.svn3272-1~lucid1_amd64.deb
wget https://launchpad.net/~mapnik/+archive/nightly-trunk/+files/mapnik2-doc_2%2Bdev20110905.svn3272-1~lucid1_all.deb
wget https://launchpad.net/~mapnik/+archive/nightly-trunk/+files/mapnik2-utils_2%2Bdev20110905.svn3272-1~lucid1_amd64.deb
wget https://launchpad.net/~mapnik/+archive/nightly-trunk/+files/python-mapnik2_2%2Bdev20110905.svn3272-1~lucid1_amd64.deb

sudo dpkg -i [each .deb]
```
(tested on release 2+dev20110905.svn3272-1~lucid1.deb)


Tile Caching
------------
Windshaft serves tiles from a single use metatile cache (from mapnik/tilelive-mapnik). This provides good speed in
addition to keeping the served maps fresh should the underlying data change or be updated. It is not, however, a full caching solution.

Should your data be less dynamic, you may want to consider improving performance by adding a simple HTTP cache such as Varnish infront of the
tile url or your own custom cache implementation. Also, see notes below on caching


Concurrency
------------
Windshaft uses node.js and tilelive-mapnik's built in evented request handling, queuing and pooling to provide excellent scalability under concurrent requests.
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
