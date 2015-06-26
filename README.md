Windshaft map tiler
===================

A Node.js map tile server for PostGIS with CartoCSS styling.

[![NPM](https://nodei.co/npm/windshaft.png?downloads=true&downloadRank=true)](https://nodei.co/npm/windshaft)

[![Build Status](https://travis-ci.org/CartoDB/Windshaft.png?branch=master)](https://travis-ci.org/CartoDB/Windshaft)
[![Code Climate](https://codeclimate.com/github/CartoDB/Windshaft/badges/gpa.png)](https://codeclimate.com/github/CartoDB/Windshaft)

* Pluggable routing to provide customizable tile API URL endpoints
* Before and after filters to allow custom access control and caching strategies
* Can render arbitrary SQL queries
* Generates image and UTFGrid interactivity tiles
* Accepts, stores, serves, and applies map styles written in [CartoCSS](https://github.com/mapbox/carto/blob/master/docs/latest.md)
* Supports re-projections
* Allows setting of CORS headers to allow access to tile data from client side

Being a dynamic map renderer, windshaft commits some map server 'sins' in
its raw form. The idea is that you the developer will want to graft your
own auth/metrics/caching/scaling on top of decent core components. Same
old story: high cohesion, low coupling makes us happy.
See [Windshaft-cartodb](https://github.com/CartoDB/Windshaft-cartodb).

Windshaft is a library used by [cartodb.com](https://cartodb.com/),
an Open Source Geospatial Database on the Cloud.


Some examples
-------------
![Playing with colors by @andrewxhill](https://github.com/CartoDB/Windshaft/raw/master/examples/images/screen_0.png) ![Circumpolar Arctic Vegetation by @andrewxhill](https://github.com/CartoDB/Windshaft/raw/master/examples/images/screen_1.png)
![Bolivia deforestation by @saleiva](https://github.com/CartoDB/Windshaft/raw/master/examples/images/screen_2.png) ![Traffic accidents by @rochoa](https://github.com/CartoDB/Windshaft/raw/master/examples/images/screen_3.png)

More examples built on top of Windshaft can be found in [CartoDB's gallery](http://cartodb.com/gallery/).


Dependencies
------------
* Node >=0.8
* npm >=1.2.1
* Mapnik 2.0.1, 2.0.2, 2.1.0, 2.2.0, 2.3.0. See [Installing Mapnik](#installing-mapnik).
* PostgreSQL >8.3.x, PostGIS >1.5.x
* Redis >2.2.x
* libcairo2-dev, libpango1.0-dev, libjpeg8-dev and libgif-dev for server side canvas support


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

var config = {
        base_url: '/database/:dbname/table/:table',
        base_url_mapconfig: '/database/:dbname/layergroup',
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
        redis: {host: '127.0.0.1', port: 6379}
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

Latest [node-mapnik](https://github.com/mapnik/node-mapnik) versions comes
compiled for some platforms and architectures, in case you need it you can
always compile, package and install it manually. The recommended option is
to use [mapnik-packaging](https://github.com/mapnik/mapnik-packaging). You
can also use other alternatives:

 - **Source**: https://github.com/mapnik/mapnik
 - **OSX**: https://github.com/mapnik/mapnik/wiki/MacInstallation_Homebrew
 - **Linux**: https://github.com/mapnik/mapnik/wiki/LinuxInstallation

Recommended options to build from source:

 - **node-mapnik**: from [1.x branch](https://github.com/CartoDB/node-mapnik/tree/1.x), current tagged version is
 [1.4.15-cdb1](https://github.com/CartoDB/node-mapnik/tree/1.4.15-cdb1), which is
 [what windshaft uses](https://github.com/CartoDB/Windshaft/blob/0.43.0/package.json#L36).
 - **mapnik**: node-mapnik uses a fixed version of mapnik, which currently is
 [82df66e](https://github.com/CartoDB/mapnik/commit/82df66e), check
 [build_against_sdk.sh#L100-L101@1.4.15-cdb1](https://github.com/CartoDB/node-mapnik/blob/1.4.15-cdb1/scripts/build_against_sdk.sh#L100-L101).

We maintain a set of [scripts/recipes to package mapnik sdk and node-mapnik](https://github.com/CartoDB/node-mapnik-packaging-recipes).
It can help to understand what you really need to package mapnik + node-mapnik to be used from windshaft[-cartodb].

Tests
-----

Windshaft has a unit and acceptance test suite.
To execute them, run `npm test`.

You'll need to be sure your PGUSER (or your libpq default) is
set to a "superuser" PostgreSQL account, for example:

```shell
PGUSER=postgres npm test
```


Troubleshooting
---------------

### Uncaught Error: Command failed running tests

You need [ImageMagick](http://www.imagemagick.org/) to run some tests. In Mac OS X
there are some issues running with latest versions of ImageMagick. If you use
[Homebrew](http://brew.sh/) you can try with a
[modified Formula to install ImageMagick version 6.7.7](https://gist.github.com/rochoa/10017167).

### Fonts: Invalid value for text-face-name

You need to install fonts at system level to be able to use them. If you face an issue like `Invalid value for
text-face-name, the type font is expected. DejaVu Sans Book (of type string) was given.` probably you don't have the
required fonts, try to install [DejaVu fonts](http://dejavu-fonts.org/wiki/Download) or any other font needed.


--
Thanks to the Mapnik and Mapbox team for making such flexible tools
