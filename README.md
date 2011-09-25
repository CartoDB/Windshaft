Windshaft map tiler
===================

A Node.js based webmercator map tile server for PostGIS with Carto map styling API.

* Pluggable routing to provide customizable tile API URL endpoints
* Can render all table data, or data restricted by SQL query
* Generates image and UTFGrid tiles
* Accepts, stores, serves, and applies map styles written in the Carto markup language (same markup as Mapbox Tilemill)
* Accepts, stores and serves Infowindow information per map layer
* Allows setting of CORS headers to allow access to tile data from Javascript
* limited caching, focus on handling concurrent renders
* No multi layer or composite support yet

Being a dynamic map renderer, windshaft commits some map server 'sins' in it's raw form. The idea is that you the developer will want to graft your own auth/metrics/caching/scaling on top of decent core components. Same old story: high cohesion, low coupling makes us happy.

Windshaft is a library used by cartodb.com, an Open Source Geospatial Database on the Cloud which will be released in the following days.


Limitations
-----------
* supports single layer render only.
* for speed, expects geometry projected to webmercator (EPSG:3857) in a column called the_geom_webmercator.


Dependencies
------------
* Node 0.4.11+ & npm
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


Installing Mapnik 2.0
----------------------

**Ubuntu**

Easy way (note, this is currently failing on Mapnik-2.0 head)

```bash
sudo apt-get install build-essential curl wget python-software-properties
sudo add-apt-repository ppa:mapnik/nightly-trunk
sudo apt-get update
sudo apt-get install libmapnik2 libmapnik2-dev mapnik2-utils
```

Fiddly but stable way

```bash

# make sure you chose the deb to match your machines architecture (amd64 or i386)

sudo apt-get install build-essential curl wget
wget http://launchpadlibrarian.net/35991565/libicu42_4.2.1-3_amd64.deb
wget https://launchpad.net/~mapnik/+archive/nightly-trunk/+files/libmapnik2-dev_2%2Bdev20110905.svn3272-1~lucid1_amd64.deb
wget https://launchpad.net/~mapnik/+archive/nightly-trunk/+files/libmapnik2_2%2Bdev20110905.svn3272-1~lucid1_amd64.deb
wget https://launchpad.net/~mapnik/+archive/nightly-trunk/+files/mapnik2-doc_2%2Bdev20110905.svn3272-1~lucid1_all.deb
wget https://launchpad.net/~mapnik/+archive/nightly-trunk/+files/mapnik2-utils_2%2Bdev20110905.svn3272-1~lucid1_amd64.deb
wget https://launchpad.net/~mapnik/+archive/nightly-trunk/+files/python-mapnik2_2%2Bdev20110905.svn3272-1~lucid1_amd64.deb

sudo dpkg -i *.deb
```

(tested on release 2+dev20110905.svn3272-1~lucid1.deb)

**OSX**

http://trac.mapnik.org/wiki/MacInstallation/Homebrew


Tile Caching
------------
Windshaft serves tiles from a single use metatile cache (from mapnik/tilelive-mapnik). This provides good speed in
addition to keeping the served maps fresh should the underlying data change or be updated. It is not, however, a full caching solution.

Should your data be less dynamic, you may want to consider improving performance by adding a simple HTTP cache such as Varnish in front of the
tile url or your own custom cache implementation. Also, see notes on caching.


Concurrency
------------
Windshaft uses node.js and tilelive-mapnik's built in evented request handling, queuing and pooling to provide excellent scalability under concurrent requests.
Should render load get too high, you may like split load over loadbalancers.


--
Thanks to the Mapnik and Mapbox team for making such flexible tools


