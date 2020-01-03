# Windshaft [![Build Status](https://travis-ci.org/CartoDB/Windshaft.svg?branch=master)](https://travis-ci.org/CartoDB/Windshaft)

A Node.js map tile library for [`PostGIS`](https://postgis.net/) and [`torque.js`](https://github.com/CartoDB/torque), with [`CartoCSS`](https://cartocss.readthedocs.io/en/latest/) styling.

* Can render arbitrary SQL queries
* Generates image and UTFGrid interactivity tiles
* Accepts, stores, serves, and applies map styles written in [`CartoCSS`](https://cartocss.readthedocs.io/en/latest/)
* Supports re-projections

Windshaft is a library used by [`CARTO`](https://carto.com/), a location intelligence and data visualization tool.

## Examples

![Playing with colors by @andrewxhill](https://github.com/CartoDB/Windshaft/raw/master/examples/images/screen_0.png) ![Circumpolar Arctic Vegetation by @andrewxhill](https://github.com/CartoDB/Windshaft/raw/master/examples/images/screen_1.png)
![Bolivia deforestation by @saleiva](https://github.com/CartoDB/Windshaft/raw/master/examples/images/screen_2.png) ![Traffic accidents by @rochoa](https://github.com/CartoDB/Windshaft/raw/master/examples/images/screen_3.png)

## Build

Requirements:

* [`Node 10.x (npm 6.x)`](https://nodejs.org/dist/latest-v10.x/)
* [`PostgreSQL >= 10.0`](https://www.postgresql.org/download/)
* [`PostGIS >= 2.4`](https://postgis.net/install/)
* [`CARTO Postgres Extension >= 0.24.1`](https://github.com/CartoDB/cartodb-postgresql)
* [`Redis >= 4`](https://redis.io/download)
* `libcairo2-dev`, `libpango1.0-dev`, `libjpeg8-dev` and `libgif-dev` for server side canvas support
* `C++11` to build internal dependencies. When there's no pre-built binaries for your OS/architecture distribution.

### Install

To fetch and build all node-based dependencies, run:

```shell
$ npm install
```

### Installing Mapnik

**Note**: only needed while developing `Mapnik` and/or `node-mapnik`.

[`node-mapnik`](https://github.com/mapnik/node-mapnik) comes compiled for some platforms and architectures, in case you need it you can always compile, package and install it manually. The recommended option is via binaries, see [`mason`](https://github.com/mapbox/mason#installation) and install `Mapnik` like:

```shell
$ mason install mapnik <version>
```

Where `<version>` is the latest released version of `Mapnik`. You can also use other alternatives:

* [`Source`](https://github.com/mapnik/mapnik)
* [`OSX`](https://github.com/mapnik/mapnik/wiki/MacInstallation_Homebrew)
* [`Linux`](https://github.com/mapnik/mapnik/wiki/LinuxInstallation)

### Usage

Probably one of the more advanced uses of `Windshaft` library can be found at [`Windshaft-cartodb`](https://github.com/CartoDB/Windshaft-cartodb) project.

### Test

```shell
$ npm test
```

### Coverage

```shell
$ npm run cover
```

Open `./coverage/lcov-report/index.html`.

### Docker support

We provide docker images just for testing and continuous integration purposes:

* [`nodejs-xenial-pg1121`](https://hub.docker.com/r/carto/nodejs-xenial-pg1121/tags)
* [`nodejs-xenial-pg101`](https://hub.docker.com/r/carto/nodejs-xenial-pg101/tags)

You can find instructions to install Docker, download, and update images [here](https://github.com/CartoDB/Windshaft-cartodb/blob/master/docker/reference.md).

### Useful `npm` scripts

Run test in a docker image with a specific Node.js version:

```shell
$ DOCKER_IMAGE=<docker-image-tag> NODE_VERSION=<nodejs-version> npm run test:docker
```

Where:

* `<docker-image-tag>`: the tag of required docker image, e.g. `carto/nodejs-xenial-pg1121:latest`
* `<nodejs-version>`: the Node.js version, e.g. `10.15.1`

In case you need to debug:

```shell
$ DOCKER_IMAGE=<docker-image-tag> npm run docker:bash
```

### Troubleshooting

#### Fonts: Invalid value for text-face-name

You need to install fonts at system level to be able to use them. If you face an issue like `Invalid value for text-face-name, the type font is expected. DejaVu Sans Book (of type string) was given.` probably you don't have the required fonts, try to install [DejaVu fonts](http://dejavu-fonts.org/wiki/Download) or any other font needed.

## Contributing

* The issue tracker: [`Github`](https://github.com/CartoDB/Windshaft/issues).
* We love Pull Requests from everyone, see [contributing to Open Source on GitHub](https://guides.github.com/activities/contributing-to-open-source/#contributing).
* You'll need to sign a Contributor License Agreement (CLA) before submitting a Pull Request. [Learn more here](https://carto.com/contributions).

## Versioning

We follow [`SemVer`](http://semver.org/) for versioning. For available versions, see the [tags on this repository](https://github.com/CartoDB/Windshaft/tags).

## License

This project is licensed under the BSD 3-clause "New" or "Revised" License. See the [LICENSE](LICENSE) file for details.
