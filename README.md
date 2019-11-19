Windshaft map tiler
===================

A Node.js map tile library for PostGIS and torque.js, with CartoCSS styling.

[![NPM](https://nodei.co/npm/windshaft.png?downloads=true&downloadRank=true)](https://nodei.co/npm/windshaft)

[![Build Status](https://travis-ci.org/CartoDB/Windshaft.png?branch=master)](https://travis-ci.org/CartoDB/Windshaft)
[![Code Climate](https://codeclimate.com/github/CartoDB/Windshaft/badges/gpa.png)](https://codeclimate.com/github/CartoDB/Windshaft)

* Can render arbitrary SQL queries
* Generates image and UTFGrid interactivity tiles
* Accepts, stores, serves, and applies map styles written in [CartoCSS](https://cartocss.readthedocs.io/en/latest/)
* Supports re-projections

Being a dynamic map renderer, windshaft commits some map server 'sins' in
its raw form. The idea is that you the developer will want to graft your
own auth/metrics/caching/scaling on top of decent core components. Same
old story: high cohesion, low coupling makes us happy.
See [Windshaft-cartodb](https://github.com/CartoDB/Windshaft-cartodb).

Windshaft is a library used by [CARTO](https://carto.com/), a location intelligence and data visualization tool.


Some examples
-------------
![Playing with colors by @andrewxhill](https://github.com/CartoDB/Windshaft/raw/master/examples/images/screen_0.png) ![Circumpolar Arctic Vegetation by @andrewxhill](https://github.com/CartoDB/Windshaft/raw/master/examples/images/screen_1.png)
![Bolivia deforestation by @saleiva](https://github.com/CartoDB/Windshaft/raw/master/examples/images/screen_2.png) ![Traffic accidents by @rochoa](https://github.com/CartoDB/Windshaft/raw/master/examples/images/screen_3.png)

More examples built on top of Windshaft can be found in [CARTO's gallery](http://carto.com/gallery/).


Dependencies
------------

- Node.js 10.x
- npm 6.x
- PostgreSQL >= 10.0
- PostGIS >= 2.4
- Redis >= 4
- libcairo2-dev, libpango1.0-dev, libjpeg8-dev and libgif-dev for server side canvas support

**Linux** Mapnik prebuilt module requires GLIBCXX_3.4.21 (GCC 5.1.0 / libstdc++-5 or higher). 

**OSX** It needs to be MacOS 10.9 or higher. It also requires pkg-config, you can install it with `brew install pkg-config`.

A C++11 compiler is required to build from source.

Dependencies installation example:

```shell
sudo add-apt-repository -y ppa:cartodb/cairo
sudo apt-get update
sudo apt-get install -y build-essential checkinstall pkg-config libcairo2-dev libjpeg8-dev libgif-dev
npm ci
```

To build the node modules dependencies (mapnik, gdal, etc) from source use `install` instead of `ci` with the following flags:

```shell
NODE_MAPNIK_BUILD=release_base npm install --build-from-source --shared_gdal
```

Install
-------

```
npm install [windshaft]
```

Usage
-----

An example http service is implemented in [examples/http/server.js](examples/http/server.js),
[examples/readme_server.js](examples/readme_server.js) extends its behaviour.

Probably one of the more advanced uses of Windshaft library can be found at
[Windshaft-cartodb](https://github.com/CartoDB/Windshaft-cartodb) project.


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

### Fonts: Invalid value for text-face-name

You need to install fonts at system level to be able to use them. If you face an issue like `Invalid value for
text-face-name, the type font is expected. DejaVu Sans Book (of type string) was given.` probably you don't have the
required fonts, try to install [DejaVu fonts](http://dejavu-fonts.org/wiki/Download) or any other font needed.

Contributing
------------

See [CONTRIBUTING.md](CONTRIBUTING.md).


--
Thanks to the Mapnik and Mapbox team for making such flexible tools
