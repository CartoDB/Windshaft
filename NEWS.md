# Version 5.4.1
2019-mm-dd

Announcements:
- pg-mvt: Remove dependency on cartodb-postgresql extension.


# Version 5.4.0
2019-06-25

Announcements:
- Upgrade `torque.js` to version `3.1.1`

# Version 5.3.0
2019-06-17

Announcements:
- In preview backend, use `@carto/cartonik` instead of `@mapbox/abaculus` to build static images.
- Upgrade `@carto/cartonik` to version 0.6.0.

# Version 5.2.1
2019-05-21

Announcements:
- Update @carto/mapnik to [`3.6.2-carto.15`](https://github.com/CartoDB/node-mapnik/blob/v3.6.2-carto.15/CHANGELOG.carto.md#362-carto15). This requires updating cartonik and abaculus too.

# Version 5.2.0
2019-04-29

Announcements:
- In mapnik renderer, use `@carto/cartonik` instead of `@mapbox/tilelive` to fetch raster/vertor tiles.

# Version 5.1.1
2019-04-15

Announcements:
- Update @carto/mapnik to [`3.6.2-carto.13`](https://github.com/CartoDB/node-mapnik/blob/v3.6.2-carto.13/CHANGELOG.carto.md#362-carto13). This requires updating tilelive-bridge, tilelive-mapnik and abaculus too.
- Remove dot (unused).

# Version 5.1.0
2019-04-02

Announcements:
- Upgrade `canvas` to version `2.4.1`
- Upgrade `torque.js` to version `3.1.0`

# Version 5.0.0
2019-03-29

Breaking changes:
- Drop support for Node.js 6
- Drop support for npm 3
- Drop support for yarn
- Stop supporting `yarn.lock`
- Drop support for Postgres 9.5
- Drop support for PosGIS 2.2
- Drop support for Redis 3

Announcements:
- Upgrades `torque.js` to version `3.0.0`
- Upgrades `grainstore` to version `2.0.0`
- Improves Travis CI workflow

Bug fixes:
- Avoid uncaught exception in Blend Renderer


# Version 4.13.5
2019-03-19

Announcements:
- Upgrade `tilelive-mapnik` to version `0.6.18-cdb20`, add header to know when a tile comes from cache (metatiling)


# Version 4.13.4
2019-03-19

Announcements:
- Upgrade `tilelive-mapnik` to version `0.6.18-cdb19`
- Upgrade `@carto/tilelive-bridge` to version `2.5.1-cdb12`


# Version 4.13.3
2019-03-13

Announcements:
- Upgrade grainstore to version 1.11.0: do not hang when child process is not able to generate a Mapnik XML


# Version 4.13.1
2019-02-11

Announcements:
- Upgrade tilelive-mapnik to version 0.6.18-cdb18.


# Version 4.13.0
2019-02-04

Announcements:
- Upgrade tilelive-mapnik to version 0.6.18-cdb17: be able to load maps with custom pool size and max waiting clients.


# Version 4.12.3
2019-01-24

Bug fixes:
- Fix compatible Node.js and npm versions


# Version 4.12.2
2019-01-23

Announcement
- Update docs: compatible Node.js and npm versions
- Deps:
  - torque.js@2.17.1
- Devel deps:
  - mocha@5.2.0
  - jshint@2.9.7


# Version 4.12.1
2018-12-13

Announcements:
 - Update cartodb-psql to 0.13.1

# Version 4.12.0
2018-11-21

Announcements:
 - Support Node.js 10 LTS
 - Add package-lock.json
 - Updated Travis configuration to run tests against Node.js 6 and 10

# Version 4.11.5
2018-10-25

Bug fixes:
 - Make all modules to use strict mode semantics.

# Version 4.11.4
2018-10-23

Announcements:
 - Fix bug when releasing the renderer cache entry in some scenarios.
 - Upgrade grainstore to [1.9.1](https://github.com/CartoDB/grainstore/releases/tag/1.9.1).

# Version 4.11.3
2018-10-19

Announcements:
 - Renderer Cache Entry: Do not throw errors for integrity checks

# Version 4.11.2
2018-10-17

Announcements:
 - pg-mvt: Accept trailing semicolon in queries

# Version 4.11.1
2018-10-16

Announcements:
 - pg-mvt: Fix bug while building query and there is no columns defined for the layer.

# Version 4.11.0
2018-10-15

Announcements:
- pg-mvt: Use `query-rewriter` to compose the query to render a MVT tile. If not defined, it will use a Default Query Rewriter.

# Version 4.10.0
2018-09-24

Announcements:
- pg-mvt: Implement timeout in getTile.
- Remove use of `step` module to handle asynchronous code, now it's defined as development dependency.

# Version 4.9.0
2018-09-05

Announcements:
- pg-mvt renderer: Match current Mapnik behaviour (Filter column with known types, same default buffer size, accept geom_column ifferent than `the_geom_webmercator`).
- pg-mvt renderer: Remove undocummented filtering by `layer.options.columns`.
- MVT tests: Compare outputs (tile and headers) from Mapnik and pg-mvt renderers.
- Update deps:
  - `@carto/mapnik` to [`3.6.2-carto.11`](https://github.com/CartoDB/node-mapnik/blob/v3.6.2-carto.11/CHANGELOG.carto.md#362-carto11): Geometries in MVTs created with the mapnik renderer will be simplified based on the layer extent instead of a static 256. This has impact in lines and polygon layers, both in results and performance since geometries were being oversimplified.
  - `@carto/tilelive-bridge` to [`2.5.1-cdb10`](https://github.com/CartoDB/tilelive-bridge/blob/2.5.1-cdb10/CHANGELOG.carto.md#251-cdb10): MVT Mapnik renderer no longers returns error on empty tile, instead it returns an empty buffer.
  - `tilelive-mapnik` to [`0.6.18-cdb15`](https://github.com/CartoDB/tilelive-mapnik/blob/0.6.18-cdb15/CHANGELOG.carto.md#0618-cdb15): Removes internal use of step and eventEmitter. Also updates and removes some dependencies.
  - `abaculus` to [`2.0.3-cdb11`](https://github.com/CartoDB/abaculus/blob/2.0.3-cdb11/changelog.carto.md#203-cdb11): Keeping up with node-mapnik update.
- MVT renderers (both): No longer returns error on empty tile. Instead it returns an empty buffer.
- MVT renderers (both): Add `vector_extent` option in MapConfig to setup the layer extent in MVTs.
- MVT renderers (both): Add `vector_simplify_extent` option in MapConfig to configure the simplification process in MVTs.
- pg-mvt renderer: Include the buffer zone in the !bbox! variable.
- pg-mvt renderer: Fix bug that caused a buffer size of value 0 being ignored.

# Version 4.8.3
2018-07-19

Announcements:
 - Validation of attributes is omitteed when sql_raw is used #643

# Version 4.8.2
2018-07-17

Announcements:
 - Add `.npmignore` to reduce size of npm package.
 - Validate buffer-size in map-config model #637


# Version 4.8.1
2018-05-28

Announcements:
 - Update `cartodb-psql` to 0.11.0

# Version 4.8.0
2018-05-21

Announcements:
 - Update deps:
   - cartodb-psql: 0.10.2
   - dot: 1.1.2
   - queue-async: 1.1.0
   - request: 2.87.0
   - semver: 5.5.0,
   - sphericalmercator: 1.0.5,
   - step: 1.0.0
   - tilelive: 5.12.3
   - torque.js: 2.16.2
 - Update dev deps:
   - express: 4.16.3
   - istanbul: 0.4.5
   - mocha: 3.5.3
 - Support `yarn.lock` file

# Version 4.7.3
2018-05-14

Announcements:
 - Set @carto/mapnik to [`3.6.2-carto.10`](https://github.com/CartoDB/node-mapnik/blob/v3.6.2-carto/CHANGELOG.carto.md#362-carto10) and tilelive-mapnik, tilelive-bridge and abaculus accordingly.

# Version 4.7.2
2018-05-08

Announcements:
 - Set @carto/mapnik to [`3.6.2-carto.9`](https://github.com/CartoDB/node-mapnik/blob/v3.6.2-carto/CHANGELOG.carto.md#362-carto9) and tilelive-mapnik, tilelive-bridge and abaculus accordingly.
 - MVT: Disable simplify_distance to avoid multiple simplifications (Postgis query and mapnik-vector-tile).

# Version 4.7.1
2018-04-17

Announcements:
 - Update @carto/mapnik to [`3.6.2-carto.8`](https://github.com/CartoDB/node-mapnik/blob/v3.6.2-carto/CHANGELOG.carto.md#362-carto8) and tilelive-mapnik, tilelive-bridge and abaculus accordingly. It brings a fix for mapnik-vector-tile to avoid mixing properties with the same value but different type.

# Version 4.7.0
2018-04-10

Announcements:
 - Adding Redis v4 in Dockerfile
 - Update @carto/mapnik to [`3.6.2-carto.7`](https://github.com/CartoDB/node-mapnik/blob/v3.6.2-carto/CHANGELOG.carto.md#362-carto7). Also updates tilelive-mapnik, tilelive-bridge, abaculus and grainstore accordingly. It brings some improvements for markers symbolizer caches as well as more performance metrics and configuration options.
 - Add a config option to disable `markers_symbolizer_caches`.
 - Mapnik renderer: Add support for render time variables in MapConfig.

# Version 4.6.0
2018-03-15

Announcements:
 - Update @carto/mapnik to 3.6.2-carto.4. Also update tilelive-mapnik, tilelive-bridge and abaculus accordingly. That version includes a cache for rasterized symbols. See https://github.com/CartoDB/node-mapnik/blob/v3.6.2-carto/CHANGELOG.carto.md#362-carto4
 - PostGIS: Variables in postgis SQL queries must now additionally be wrapped in `!` (refs [#29](https://github.com/CartoDB/mapnik/issues/29), [mapnik/#3618](https://github.com/mapnik/mapnik/pull/3618)):
```sql
-- Before
SELECT ... WHERE trait = @variable

-- Now
SELECT ... WHERE trait = !@variable!
```

# Version 4.5.7
2018-03-14

Announcements:
 - Fix bug when parsing incomplete Mapnik metrics

# Version 4.5.6
2018-03-12

Announcements:
 - AttributesBackend: Support distinct and json_agg

# Version 4.5.5
2018-03-12

Announcements:
 - Update request to 2.85.0

# Version 4.5.4
2018-03-09

Announcements:
 - AttributesBackend: Allow multiple points if all the attributes are the same
 - Avoids mapnik conflict: Update tilelive-mapnik#0.6.18-cdb7, tilelive-bridge#2.5.1-cdb3

# Version 4.5.3
2018-02-13

Announcements:
 - Mapnik metrics: Apply top metrics to all posibilities (formats / error strategies)

# Version 4.5.1 // 4.5.2
2018-02-12

Announcements:
 - Mapnik metrics: Use several individual objects instead of children

# Version 4.5.0
2018-02-06

Announcements:
 - Add option to request Mapnik metrics.

# Version 4.4.0
2018-02-05

Announcements:
 - Upgrade redis-mpool to 0.5.0.

# Version 4.3.3
2018-01-31

Announcements:
 - Do not expose 'cache-features' in Mapconfig (can only be set via configuration)

# Version 4.3.2
2018-01-31

Announcements:
 - Support layer 'cache-features' in Mapnik/CartoDB layers.

# Version 4.3.1
2018-01-29

Announcements:
 - Upgrade mapnik to @carto/mapnik 3.6.2-carto.2, which uses carto lib mapnik v3.0.15.3 underneath and fixes a performance regression in rendering of labels.

# Version 4.3.0
2018-01-11

Bug fixes:
 - Fix broken torque tests for PG9.6+

New features:
 - Now mapnik has support for fine-grained metrics.
 - Variables can be passed for later substitution in postgis datasource.

Announcements:
 - Upgrade mapnik to @carto/mapnik 3.6.2-carto.1, which uses carto lib mapnik v3.0.15.2 underneath. See https://github.com/CartoDB/mapnik/blob/v3.0.15-carto/CHANGELOG.carto.md and https://github.com/CartoDB/mapnik/blob/v3.0.15-carto/CHANGELOG.carto.md
 - Upgrade tilelive-bridge to @carto/tilelive-bridge 2.5.1-cdb1. See https://github.com/CartoDB/tilelive-bridge/blob/cdb-2.x/CHANGELOG.carto.md
 - Upgrade tilelive-mapnik to 0.6.18-cdb4
 - Upgrade abaculus to 2.0.3-cdb2
 - Upgrade grainstore to 1.8.1
 - Use yarn instead of npm
 - Use the script docker-test.sh for travis builds


# Version 4.2.0
2018-01-02

New features:
 - Support layer minzoom and maxzoom in Mapnik/CartoDB layers #585.
 - PostGIS vector renderer: be able to retrieve required columns #583.

Announcements:
 - Upgrade grainstore to version 1.8.0.


# Version 4.1.1
2017-12-28

Bug-fixes:
 - Fix support for single layer id filters #584.


# Version 4.1.0
2017-12-04

 - Allow to request MVT tiles without CartoCSS
 - Upgrade grainstore to version 1.7.0


# Version 4.0.1
2017-10-27

Bug-fixes:
 - Add support for gziped responses coming from marker-file urls #571


# Version 4.0.0
2017-10-11

Breaking changes:
 - Removes support for geojson tiles.


# Version 3.3.3
2017-10-03

Announcements:
- Upgrade debug to 3.1.0
- Upgrade request to 2.83.0


# Version 3.3.2
2017-09-18

Bug-fixes:
- Fix static map image generation when basemap tiles are bigger than 256px (@2x, 512px, etc)


# Version 3.3.1
2017-08-13

Announcements:
 - Upgrade cartodb-psql to [0.10.1](https://github.com/CartoDB/node-cartodb-psql/releases/tag/0.10.1).


# Version 3.3.0
2017-08-09

Announcements:
 - Upgrade tilelive-bridge to [2.3.1-cdb4](https://github.com/CartoDB/tilelive-bridge/releases/tag/2.3.1-cdb4).
 - Upgrade tilelive-mapnik to [0.6.18-cdb3](https://github.com/CartoDB/tilelive-mapnik/releases/tag/0.6.18-cdb2).
 - Upgrade cartodb-psql to [0.9.0](https://github.com/CartoDB/node-cartodb-psql/releases/tag/0.9.0).


# Version 3.2.2
2017-07-20

Announcements:
 - Upgrade tilelive-bridge to [2.3.1-cdb3](https://github.com/CartoDB/tilelive-bridge/releases/tag/2.3.1-cdb3).


# Version 3.2.1
2017-05-31

Bug fixes:
 - Removed dead code while extracting layer metadata stats #551.


# Version 3.2.0
2017-05-18

Announcements:
 - Use different buffer-size values for different tile formats.
 - Official support for `buffer-size` at layergroup level.
   * Check [doc/MapConfig-1.6.0.md](doc/MapConfig-1.6.0.md) for more details.
 - Upgrade tilelive-bridge to [2.3.1-cdb2](https://github.com/CartoDB/tilelive-bridge/releases/tag/2.3.1-cdb2).
 - Upgrade tilelive-mapnik to [0.6.18-cdb2](https://github.com/CartoDB/tilelive-mapnik/releases/tag/0.6.18-cdb2).


# Version 3.1.2
2017-05-05

Announcements:
 - Upgrade cartodb-psql to [0.8.0](https://github.com/CartoDB/node-cartodb-psql/releases/tag/0.8.0).


# Version 3.1.1
2017-04-25

Bug fixes:
 - Don't default formats in formatMetatile configuration #545.


# Version 3.1.0
2017-03-30

Bug fixes:
 - Only release renderer if exists.

Announcements:
 - Remove forced GC cycle after renderer removal.


# Version 3.0.1
2017-03-21

Bug fixes:
 - Use `binary` encoding for generating MapConfig.id.


# Version 3.0.0
2017-03-16

Announcements:
 - Supports Node v6.9.x
 - Drops support for Node v0.10.x
 - Upgrades mapnik to 3.5.14
 - Upgrades tilelive to 5.12.2
 - Upgrades tilelive-bridge to 2.3.1-cdb1
 - Upgrades tilelive-mapnik to 0.6.18-cdb1
 - Upgrades sphericalmercator to 1.0.4
 - Upgrades abaculus to 2.0.3-cdb1
 - Upgrades canvas to 1.6.2-cdb2
 - Upgrades carto to 0.15.1-cdb3
 - Upgrades redis-mpool to 0.4.1


# Version 2.8.0
2017-03-16

**Deprecation warning**: v2.8.0 is the last release that supports Node v0.10.x. Next mayor release will support Node v6.9.x and further versions.

New features:
 - Honour "srid" option in mapnik layer.

Announcements:
 - Upgrades grainstore to [1.6.0](https://github.com/CartoDB/grainstore/releases/tag/1.6.0).


# Version 2.7.0
2017-02-20

Announcements:
 - Upgrades cartodb-psql to [0.7.1](https://github.com/CartoDB/node-cartodb-psql/releases/tag/0.7.1).


# Version 2.6.5
2016-12-13

Announcements:
 - Upgrades request dependency.


# Version 2.6.4
2016-12-13

Announcements:
 - Upgrades grainstore to [1.4.0](https://github.com/CartoDB/grainstore/releases/tag/1.4.0).


# Version 2.6.3
2016-12-01

Announcements:
 - Upgrades grainstore to [1.3.0](https://github.com/CartoDB/grainstore/releases/tag/1.3.0).


# Version 2.6.2
2016-11-05

Bug fixes:
 - Now validates all mapnik layers and if it fails then checks layer by layer to indicate which one fails.


# Version 2.6.1
2016-11-01

Bug fixes:
 - Fix bad behavior in map validator, now validates layer by layer to indicate which one fails.


# Version 2.6.0
2016-10-31

Enhancements:
 - Expose layer index if map validation fails.


# Version 2.5.0
2016-08-17

Announcements:
 - Allow to show & hide mapnik layers filtering by indexes in URL.


# Version 2.4.2
2016-08-12

Announcements:
 - Use S3 bucket for mapnik module.


# Version 2.4.1
2016-08-11

Announcements:
 - Use github's git URL for dependencies instead of tarballs.


# Version 2.4.0
2016-06-29

Enhancements:
  - Errors during MapConfig's instantiation return the layer-id to give more info about what's going on.


# Version 2.3.0
2016-06-08

Enhancements:
 - Only adds cartocss to meta for layers where it makes sense.

New features:
 - Expose layer id in metadata.


# Version 2.2.0
2016-06-07

Improvements:
 - Allow to set id per layer #485

Announcements:
 - Upgrades grainstore to 1.2.0


# Version 2.1.0
2016-06-06

Improvements:
 - Adds support for substitution tokens in geojson tiles


# Version 2.0.1
2016-06-02

Bug fixes:
 - Geojson renderer: columns option should ignore nulls #481


# Version 2.0.0
2016-06-02

Announcements:
 - Removes support for widgets/filters introduced in version 1.7.0.


# Version 1.20.0
2016-06-02

Announcements:
 - Upgrades mapnik to [cartodb/node-mapnik@1.4.15-cdb8](https://github.com/CartoDB/node-mapnik/releases/tag/1.4.15-cdb8)


# Version 1.19.0
2016-04-28

New features:
 - Adds support for buffer-size CartoCSS Map property in geojson tiles.

Announcements:
 - Upgrades carto to 0.15.1-cdb2


# Version 1.18.0
2016-04-27

New features::
 - Handles columns defined in layer options to fill properties to render GeoJSON format


# Version 1.17.3
2016-04-27

Enhancements:
 - Columns defined in dataviews specification are taking into account to fill properties in geojson renderer


# Version 1.17.2
2016-04-26

Enhancements:
 - Skip mapnik properties in geojson renderer


# Version 1.17.1
2016-04-18

Enhancements:
- GeoJSON renderer: removing ST_MakeValid, it might fail for some tiles but it's way better performance wise.


# Version 1.17.0
2016-04-06

New features:
 - GeoJSON renderer (#451):
  - Adds precision to ST_AsGeoJSON based on zoom
  - Handle interactivity columns as they might be arrays or strings
  - Simplify geometries keeping at least their bbox

# Version 1.16.1
2016-03-23
 - Improves column extraction from cartocss #466


# Version 1.16.0
2016-03-16

Announcements:
 - Now GeoJSON Renderer fills properties with columns that are required in CartoCSS, Widgets and Interactivity.


# Version 1.15.0
2016-03-15

Announcements:
 - Added cartocss to metadata of layergroup[#462]


# Version 1.14.0
2016-03-14

Announcements:
 - Removed experimental support for turbo-cartocss [#459]

# Version 1.13.2
2016-02-25

Enhancements:
 - Ignore turbo-cartocss error when it fails and continue to carto parser


# Version 1.13.1
2016-02-24

Enhancements:
 - Do not use st_makevalid for && envelope


# Version 1.13.0
2016-02-24

Enhancements:
 - Improved experimental support for turbo-cartocss with number of buckets #442


# Version 1.12.0
2016-02-23

New features:
 - Experimental support for turbo-cartocss #438


# Version 1.11.1
2016-02-22

Enhancements:
 - Geojson make valid #437


# Version 1.11.0
2016-02-18

New features:
 - Histogram can be retrieved with a fix number of bins #433


# Version 1.10.1
2016-02-15

Enhancements:
 - Removes console.* calls


# Version 1.10.0
2016-02-15

New features:
 - Async filter params #431

Enhancements:
 - Geojson buffer fixed to 32px #430


# Version 1.9.0
2016-02-09

New features:
- Provisional internal query-rewriting interface for Windshaft-cartodb tests


# Version 1.8.3
2016-02-08

Enhancements:
 - Widgets histogram improvements: type casting when required #428
 - Widgets async queries #427


# Version 1.8.2
2016-02-04

Bug fixes:
 - Use datasource from layer id to compute mapnik layers metadata


# Version 1.8.1
2016-02-04

Announcements:
 - Upgrades grainstore to [1.1.1](https://github.com/CartoDB/grainstore/releases/tag/1.1.1)


# Version 1.8.0
2016-02-04

New features:
 - Supported GeoJSON format for MVT tiles #421


# Version 1.7.0
2016-01-20

New features:
 - Allow to use Substitution tokens with attributes service #416

Unsupported:
 - Histograms, aggregations, formulas, and lists
 - Filters

Note: API for unsupported list might change in the future, use at your own peril.


# Version 1.6.1
2015-11-23

Announcements:
 - Upgrades tilelive-mapnik to not cache solid grids


# Version 1.6.0
2015-11-11

Announcements:
 - Upgrades mapnik to [cartodb/node-mapnik@1.4.15-cdb6](https://github.com/CartoDB/node-mapnik/releases/tag/1.4.15-cdb6)


# Version 1.5.0
2015-10-29

Announcements:
 - Upgrades mapnik to [cartodb/node-mapnik@1.4.15-cdb5](https://github.com/CartoDB/node-mapnik/releases/tag/1.4.15-cdb5)
 - Upgrades all mapnik dependants to upgrade their mapnik dependency


# Version 1.4.0
2015-10-28

Announcements:
 - Upgrades mapnik to [cartodb/node-mapnik@1.4.15-cdb4](https://github.com/CartoDB/node-mapnik/releases/tag/1.4.15-cdb4)
 - Upgrades all mapnik dependants to upgrade their mapnik dependency


# Version 1.3.0
2015-10-28

Announcements:
 - Upgrades mapnik to [cartodb/node-mapnik@1.4.15-cdb3](https://github.com/CartoDB/node-mapnik/releases/tag/1.4.15-cdb3)
 - Upgrades all mapnik dependants to upgrade their mapnik dependency


# Version 1.2.0
2015-10-21

New features:
 - Adds support for `png32` format in mapnik layers (#344)


# Version 1.1.1
2015-10-21

Enhancements:
 - Removes step dependency in RendererCache


# Version 1.1.0
2015-10-09

New features:
 - Adds support for substitution tokens in Torque (#392)
   Supported substitution tokens are: `!bbox!`, `!pixel_width!`, `!pixel_height!`, and `!scale_denominator!`.


# Version 1.0.1
2015-09-30

Bug fixes:
 - Lowercasing dbparams in MapConfig to be backwards compatible


# Version 1.0.0
2015-09-30

From Semantic Versioning:
> Major version zero (0.y.z) is for initial development. Anything may change at any time. The public
API should not be considered stable.

As we are following Semantic Versioning and we didn't release any major > 0 we could change anything with next minor
bump but I would like to make this version 1.0.0 so this stays as the first public API.

A lot of things have changed/moved/disappeared, internal API has nothing to do with previous one.

List of changes:

 - RendererCache now works with MapConfig providers (~~needs documentation~~).
 - Backends hold a RendererCache, so they also work with MapConfig providers
 - More specific backends: tiles, previews, map, validator, attributes
 - Express no longer a dependency
 - Makefile picks tests with `find`, no need to add files manually
 - Example contains a basic server similar to original windshaft's server
 - Test environment now extends development
 - Mapnik factory no longer supports snapToGrid and clipByBox2d
 - RendererFactory now supports a `mapnik` filter to retrieve all mapnik layers
 - Starts using debug to no output to stdout by default
 - Removes stats code: profiler, client, reporter
 - Major rewrite of tests to not rely on server
 - Support for `MVT` format in mapnik renderer
 - Official support for `plain` layer type: options include `color` and `imageUrl`.
   * Check [doc/MapConfig-1.4.0.md](doc/MapConfig-1.4.0.md#24-plain-layers-options) for more details.


# Version 0.51.0
2015-08-27

New features:
 - When gc extension is enabled with `--expose_gc` flag, RendererCache will invoke gc 1 out of 10 times it runs.


# Version 0.50.0
2015-08-25

Enhancements:
 - Implements close mechanism for torque renderer to free canvas' images
 - Base adaptor exposes and calls renderers' close if available
 - Blend renderer calls close on all renderers

Bug fixes:
 - Honor RenderCache ttl option

Announcements:
 - Do not report png cache size on renderers
 - Uses [cartodb/node-canvas@1.2.7-cdb1](https://github.com/CartoDB/node-canvas/releases/tag/1.2.7-cdb1)


# Version 0.49.0
2015-08-18

New features:
 - Exposes tilelive-mapnik internal metatile cache configuration

Bug fixes:
 - Renderer stats for pool and cache now reports from all renderers

Announcements:
 - Changes abaculus and tilelive-mapnik to use `cdb` branch


# Version 0.48.0
2015-07-15

Announcements:
 - Upgrades mapnik to [cartodb/node-mapnik@1.4.15-cdb2](https://github.com/CartoDB/node-mapnik/releases/tag/1.4.15-cdb2)
 - Upgrades abaculus and tilelive-mapnik to also use node-mapnik@1.4.15-cdb2


# Version 0.47.0
2015-07-05

Enhancements:
 - Upgrades grainstore to [1.0.0](https://github.com/CartoDB/grainstore/releases/tag/1.0.0)
 - Upgrades redis-mpool to [0.4.0](https://github.com/CartoDB/node-redis-mpool/releases/tag/0.4.0)


# Version 0.46.1
2015-07-02

Enhancements:
 - Blend renderer doesn't blend if there is only one tile to blend


# Version 0.46.0
2015-07-02

Announcements:
 - Removes `beforeTileRender` and `afterTileRender` triggers, use version `~0.45.0` to keep them

Enhancements:
 - Checks for ETIMEDOUT error code so timeouts do not turn into empty image in http layers (#360)
 - Allows to set metatile based on the format


# Version 0.45.0
2015-06-18

Enhancements:
 - Handles coordinates out of range errors returning an empty image
 - Blend rendering fallback to empty image when http layer request fails
 - Checks the type of torque-specific CSS rules
 - Unifies error response format to `{ "errors": ["messages"] }`

Announcements:
 - Removes LocalizedResourcePurger to avoid issues with cached assets
   See https://github.com/CartoDB/Windshaft/issues/339#issuecomment-104684003


# Version 0.44.1
2015-06-01

Enhancements:
 - Performance improvement while retrieving metadata for layergroups
   Does not create renderers for layers with no metadata


# Version 0.44.0
2015-05-26

New features
 - Blend rendering now allows to filter the layers to render
   Layer argument in URL accepts comma separated layer indexes, so now it's possible to do requests like:
   `GET /{layergroupid}/0,3,4/{z}/{x}/{y}.png` and will blend just layers 0, 3 and 4, skipping 1 and 2.
   See [Multilayer-API.md](doc/Multilayer-API.md) for more details.
 - Layergroup creation returns metadata for all layers (#338)
   Keeps backwards compatibility for torque metadata
 - Renderer selection based on layer (#336)
   Before the renderer selection was based on the format
   For instance that meant it wasn't possible to request layer in png because that was returning just mapnik layers


# Version 0.43.0
2015-04-29

New features
 - Static map backend to retrieve preview images.
   Implementation extracted from static maps controller.

Bug fixes:
 - Do not use headers from abaculus in combination with sendWithHeaders
   That was overriding Cache-Control header in static images


# Version 0.42.2
2015-04-16

Enhancements:
 - Improve mapnik renderer stats


# Version 0.42.1
2015-04-15

Bug fixes:
 - Do not profile during map validation (#318)

Enhancements:
 - Wrap x coordinate based on zoom level to avoid negative x coordinates


# Version 0.42.0
2015-04-09

New features:
 - `tms` option for `http` layers to invert Y axis in TMS services

Bug fixes:
 - Proper stats client instead of stubbed one


# Version 0.41.0
2015-04-07

New features:
 - onTileErrorStrategy can be injected into adaptors to intercept tile errors and change behaviour
 - beforeRendererCreate hook in RenderCache to add options when creating a new Renderer

Announcements:
 - Renderer factories changed getRenderer signature, check [renderers/README](./lib/windshaft/renderers/README.md)
 - Remove tile / style endpoints AKA old API (#259). Most likely this will evolve into a 1.0.0 release.
 If you **want to keep using those endpoints** the best option is to **freeze windshaft version @0.40.0**.
   - Changes includes:
     * Before/after state change hooks for styles removed
     * Render cache now based on dbname + token
     * processRendererCache hook removed
     * Changes a lot of tests to use layergroup
     * New features in testClient to support kind of transactions with layergroups

Bug fixes:
 - Layergroup creation via GET returns with status 200 for JSONP (#302)


# Version 0.40.0
2015-03-11

New features:
 - Adds stats from tilelive-mapnik to step-profiler: it discerns about rendering and encoding times
 - Profiler proxy now with add method

Announcements:
 - Upgrades step-profiler and tilelive-mapnik to handle new metrics


# Version 0.39.0
2015-03-09

New features:
 - Allow buffer-size in torque server side rendering (#292)

Bugfixes:
 - Support for torque heatmaps server side rendering (#294)

Enhancements:
 - Upgrades tilelive-mapnik@0.6.15 to use fromString async method to create map objects
 - Upgrades torque.js@2.11.0


# Version 0.38.2
2015-02-26

Announcements:
 - Upgrades node-canvas 1.2.1


# Version 0.38.1
2015-02-25

Announcements:
 - Upgrades node-canvas 1.2.0


# Version 0.38.0
2015-02-23

Bugfixes:
 - Adds qualifyURL function as option for the Point renderer (#272)
   - For now it is just an identity function

Announcements:
 - Upgrades carto to 0.15.1-cdb1 (#271)
 - Upgrades torque.js to 2.10.0 (#271)


# Version 0.37.5
2015-02-20

Enhancements:
 - Force followRedirect in http renderers (#268)


# Version 0.37.4
2015-02-18

Enhancements:
 - Allow exact match along regex matching in urlTemplate for http layers


# Version 0.37.3
2015-02-17

Bugfixes:
 - Use datasource for layer when retrieving attributes (#266)


# Version 0.37.2
2015-02-17

Enhancements:
 - Do not use `inner_cdbq` wrapped queries if `ST_ClipByBox2D` or `ST_SnapToGrid` are not enabled.


# Version 0.37.1
2015-02-17

Enhancements:
 - Make `urlTemplate` option mandatory in http layers (#265)


# Version 0.37.0
2015-02-16

New features:
 - Improvements for Mapnik queries using ST_SnapToGrid and ST_ClipByBox2D. New queries can be enabled via config:
    * `renderer.snapToGrid=true` will ONLY use ST_SnapToGrid
    * `renderer.snapToGrid=true` and `renderer.clipByBox2d=true` will use both: ST_SnapToGrid and ST_ClipByBox2D
        - ST_ClipByBox2D requires Postgis >=2.2
        - This requires function CDB_ScaleDenominatorToZoom

Bugfixes:
 - Don't allow to instantiate a mapnik raster layer with interactivity option (#244)


# Version 0.36.0
2015-02-13

New features:
 - Adds a fallback http renderer
 - Mapconfig per layer datasource
 - Plain renderer based on mapnik.Image
 - Enable regex matching in valid url templates for http renderer

Bugfixes:
 - Use a different zero-based index for grid layers so they can pick up their proper interactivity (#253)

Enhancements:
 - Create layergroup improvements, model now does all the validation for the mapconfig


# Version 0.35.1
2015-01-28

Bugfixes:
 - Fix grid layers order to have the proper index in grainstore (#253)


# Version 0.35.0
2015-01-27

Announcements:
 - Freeze torque.js version to 2.8
 - Makes mapconfig `1.3.0` version final, no more `1.3.0-alpha` version required


# Version 0.34.0
2015-01-15

New features:
 - New endpoint for map config tiles to be rendered with different resolutions, à la retina display.
   - Resolution can be specified with `{z}/{x}/{y}@{resolution}x.png`, like in `0/0/0@2x.png`.
   - It only supports mapnik tiles right now, torque png tiles should be next.

Announcements:
 - Remove full layerconfig dump to logfile


# Version 0.33.0
2015-01-14

New features:
 - Static previews with support for base layers (HTTP layers) and torque layers
 - Support to render/proxy HTTP layers
 - Render torque tiles server side
   - It misses rendering with *buffer size*

Announcements:
- Remove support for global_cartocss and global_cartocss_version in multilayer config (#207)

Enhancements:
 - Split big server.js file into controllers
 - Split RenderCache: renderer factory so RenderCache does not know about mapnik (not totally true)
 - Don't expose the underlying map configuration store technology
 - Reset getInstance method after each test


# Version 0.32.4
2014-12-15

Bugfixes:
 - Torque Infinity number of steps (#233)


# Version 0.32.3
2014-12-15

Bugfixes:
 - Fix incorrect number of steps in Torque (see https://github.com/CartoDB/torque/issues/60)

Enhancements:
 - Split torque renderer functionality into several files


# Version 0.32.2
2014-12-11

Announcements:
 - Upgrades mapnik


# Version 0.32.1
2014-12-02

Announcements:
 - Upgrades grainstore dependency


# Version 0.32.0
2014-11-05

New features:
 - Add support for raster layers (#190)
 - Expose tilelive so it is possible to use the same version externally


# Version 0.31.0
2014-10-20

Enhancements:
 - Don't autoload fonts when creating new tilelive-mapnik objects
 - Add a couple of metrics in render cache to track xml generation and tilelive loading time


# Version 0.30.0
2014-10-15

New features
 - Report stats about number of renderers and mapnik pools


# Version 0.29.0
2014-10-15

New features:
 - Exposes statsd client globally


# Version 0.28.2
2014-10-14

Bug fixes:
 - Consider resolution to determine the LEAST value in torque queries


# Version 0.28.1
2014-10-13

Bug fixes:
 - Delays RenderCache initialization so StatsD client is created with proper configuration


# Version 0.28.0
2014-10-03

Announcements:
 - Comes back to use mapnik 2.3.x from cartodb/node-mapnik@1.4.15-cdb branch


# Version 0.27.2
2014-10-01

Announcements:
 - Downgrades node-mapnik to 0.7.26-cdb1


# Version 0.27.1
2014-09-30

Announcements:
 - Downgrades node-mapnik to 1.4.10

Enhancements:
 - Upgrades mocha

# Version 0.27.0
2014-09-24

New features:
 - Starts using mapnik 2.3.x with node-mapnik 1.4.15

Enhancements:
 - Upgrades grainstore dependency to be able to use 2.3.0 carto styles


# Version 0.26.0
2014-09-18

Enhancements:
 - Torque query improvements
 - New header for database host serving the request
 - Metrics revamp: removes and adds some metrics
    - Profiler is now always available as a proxy so no need to keep checking
      if it exists.
    - Tracks and reports time for torque queries, using chronograph module
 - Stats client now lives in its own file
 - Upgrade dependencies:
    - grainstore
    - tilelive-mapnik
    - tilelive

Bug fixes:
 - Increments counters and track timers only for supported formats
 - Support specifying column name in MapConfig (#191)


# Version 0.25.1
2014-08-19

Bug fixes:
 - Responds with 400 error on invalid json input (#156)

# Version 0.25.0
2014-08-18

Enhancements:
 - Removes npm-shrinkwrap.json as it was a temporary measure to fix a problem
   with srs.

New features:
 - Deprecates psql and starts using cartodb-psql module


# Version 0.24.1
2014-08-13

Enhancements:
 - Checks mapnik version for grainstore is configured, otherwise it uses
   installed one


# Version 0.24.0
2014-08-13

 Enhancements:
 - Upgrades dependencies:
    - underscore
    - grainstore
    - redis-mpool
    - pg
 - Specifies name in the redis pool


# Version 0.23.0
2014-08-07

 New features:

 - Upgrade to grainstore 0.19.0 version

# Version 0.22.0
2014-07-30

 Enhancements:

 - dbhost and dbport are no longer hashed in on the MapConfig identifier hash,
   so dbhost and dbport can be dynamically altered at runtime keeping the same
   URL schema.
 - Cache buster does not invalidate renderer if it is numeric and smaller
   than cached buster (#177)
 - Literal expression for some regular expressions
 - Profiler header sent as JSON string

 Bug fixes:

 - Returns 400 errors for bad filters and missing columns in queries

 Other changes:

 - Metrics documentation

# Version 0.21.0
2014-05-07

 Enhancements:

 - Make tests runnable in Mac OS X
 - Code reorganization for CacheEntry
 - assert helper now support per mil tolerance to check image equality

 Bug fixes:

 - Do not omit points close to the tile boundary from torque tiles (#186)
 - Use correct torque.js dependency

# Version 0.20.0
2014-03-20

 Enhancements:

 - Do not cache bogus renderers (#171)
 - Upgrade carto to 0.9.5-cdb3
 - Use INFO level for express logging
 - Do not include connection info in error responses (#173)

 Other changes:

 - Use external module as profiler (#174)
 - Switch to 3-clause BSD license (#175)

# Version 0.19.4
2014-03-05

 Enhancements:

 - Catch statsd exceptions (#166, #167)

# Version 0.19.3
2014-03-04

 Enhancements:

 - Log full connection string on PostgreSQL connection error (#165)
 - Prefix statsd resulting from hits of / and /version endpoints
 - Use 403 status, not 401, for forbidden access
 - Upgrade grainstore to 0.18.1

# Version 0.19.2
2014-02-27

 Enhancements:

 - Send 404 instead of 400 on attempts to fetch non-existing database items
 - Send 500 status and better error message on db connection error
 - Use "TorqueRenderer" prefix for errors generated by it (#164)
 - Inject db parameters in user-provided MapConfig objects (#163)

# Version 0.19.1
2014-02-26

 Enhancements:

 - Do not send 0 timings to statsd (fixes "Bad line: 0,ms" messages)
 - Do not call req2params more then once on MapConfig creation (#157)
 - Do not invalidate renderer caches when NO cache_buster is given (#158)
 - Call afterLayergroupCreate only after MapConfig verification (#159)
 - Drop LRU cache for "seen" layergroups (#160)
 - Clearer error on mapnik tokens use with attribute service (#154)
 - Include MapConfig specification and MultilayerAPI documents in repo

 Bug fixes:

 - Fix MapStore.save always false "known" return variable (#162)

# Version 0.19.0
2014-02-19

 New features:

 - Use own .sendResponse function for all responses
 - Make MapStore instance accessible via app
 - Allow passing RedisPooler via server options (#146)

 Enhancements:

 - Use log4js express logger if global.log4js is defined (#140)
 - Include format in rendering profile labels (#152)

# Version 0.18.2
2014-02-17

 Bug fixes:

 - Fix error message on unexistent map config token (#148)

 Enhancements:

 - Integrate statsD support in Profiler

# Version 0.18.1
2014-02-13

 Bug fixes:

 - Fix duplicated garbage collection via grainstore upgrade

 Enhancements:

 - Speed up construction of mapnik renderers
 - Allow disabling statsD via configuration (#144)

# Version 0.18.0
2014-02-12

 Enhancements:

 - Advertise support for node-0.10 (#128)
 - Use a single pooler for mapnik and torque renderers (#142)
 - Improve garbage collection performance (#141)
 - Add statsd support

# Version 0.17.2
2014-02-11

 Enhancements:

 - Reduce debug logs (#139)

# Version 0.17.1
2014-02-11

 Bug fixes:

 - Check attribute service validity at MapConfig creation time (#131)
 - Use read-only transactions for torque tiles and attributes (#130)
 - Fix reading database password (dbpassword) from req.param (#134)

 Enhancements:

 - Add 'torque.json' and 'torque.bin' format aliases (#133)
 - Allow specifying name of torque geometry column in the MapConfig (#125)
 - Improve error message on attempts to fetch torque tile from
   non-torque layers (#136)
 - Include X-Tiler-Profiler header in POST /style endpoint (#138)
 - Improve speed of POST /style and DELETE /style (#138)

# Version 0.17.0
2014-02-04

 New features:

 - Configurable endpoint for multilayer API (#126)

 Bug fixes:

 - Fix coordinate order in TorqueRenderer.getTile

# Version 0.16.0
2014-02-04

 New features:

 - Support for torque tiles (#113)
 - New attributes service (#121)

 Enhancements:

 - Store full layergroup configuration in redis (#114)

 Backward incompatible changes:

 - Drop support for XML processor hook (#119)

# Version 0.15.1
2014-01-30

 Bug fixes:

 - Fix testsuite run against PostGIS-1.5 (#108, #109)
 - Fix core dependency list to include 'semver' (#112)
 - Fix use of maxzoom (#78, again)

# Version 0.15.0
2014-01-14

 New features:

 - Make strict XML parsing configurable via params (#100)

 Bug fixes:

 - Fix restore of localized resources on renderer creation (#107)

# Version 0.14.5
2013-12-05

 - Fix use of layergroups on mapnik upgrade (#101)

# Version 0.14.4
2013-11-28

 - Update tilelive-mapnik to upsteam version 0.6.4 (#86)
 - Survive presence of malformed CartoCSS in redis (#97)
 - Validate fonts at CartoCSS rendering time (#98)

# Version 0.14.3
2013-11-13

 - Return CORS headers when creating layergroups via GET (#92)
 - Fix http status on database authentication error (#94)
 - Ensure bogus text-face-name error raises at layergroup creation (#93)

# Version 0.14.2
2013-11-08

 - Fix parsing of CartoCSS filter values using exponential notation (#90)

# Version 0.14.1
2013-10-31

 - Update grainstore dep to ~0.14.1
 - Fix test preparation when postgresql params are set

# Version 0.14.0
2013-10-31

 - Support for Mapnik 2.2.0 (#89)

# Version 0.13.7
2013-10-03

 - Require grainstore 0.13.11, fixing support for apostrophes
   in CartoCSS (#87)

# Version 0.13.6
2013-09-12

 - Require grainstore 0.13.10, fixing error message for
   some invalid cartocss (#85)

# Version 0.13.5
2013-09-09

 - Always use http status 200 for jsonp requests (#84)
 - Upgrade grainstore to 0.13.9, fixing " zoom" error
   "sql/table must contain zoom variable"

# Version 0.13.4
2013-09-04

 - Fix race condition with external resources (#82)

# Version 0.13.3
2013-09-03

 - Upgrade tilelive-mapnik to use eio-2.1.0
 - Enable travis-ci

# Version 0.13.2
2013-08-13

 - Rewrite mapnik XML parsing error to start with style name (#73)
 - Fix error on empty CartoCSS

# Version 0.13.1
2013-07-18

 - Do not print profile to stdout (use log_format for that)
 - Include renderer build time to profile
 - Do not re-check layergroup configs with no interaction
 - Log full layergroup config with resulting token on creation (#80)

# Version 0.13.0
2013-07-16

 - Add support for profiling requests

# Version 0.12.10
2013-07-16

 - Improve error message on blank CartoCSS in multilayer config

# Version 0.12.9
2013-07-04

 - Do not assume already-tested layergroup config was good (#79)

# Version 0.12.8
2013-06-28

 - Allow setting layergroup token ttl via config variable
   grainstore.default_layergroup_ttl
 - Only check layergroup configuration when first seen (#77)
 - Use tile 30/0/0 for testing layergroups, override with maxzoom (#78)

# Version 0.12.7
2013-06-26

 - Do not confuse single layergroup creation errors with multiple errors

# Version 0.12.6
2013-06-21

 - Try fetching tile and grids on layergroup creation, early reporting errors

# Version 0.12.5
2013-06-12

 - Redis moved to a devDependency, and upgraded to ~0.8.3
 - Grainstore dependency raised to ~0.13.4, fixing possible deadlocks
   during map styles gc operations.

# Version 0.12.4
2013-06-06

 - Grainstore dependency raised to ~0.13.3

# Version 0.12.3
2013-05-29

 - Do not confuse colors with layer names (#72)

# Version 0.12.2
2013-05-29

 - Fix handling of layer name placeholder in multi-section CSS (#71)

# Version 0.12.1
2013-05-21

 - Add possibility to specify a literal cache_buster value in benchmark.js
 - Allow Content-Type with encoding on /layergroup POST (#70)

# Version 0.12.0
2013-04-04

 - Multilayer API changes
   - Interactivity layers are referenced by index (0-based)
   - Interactivity fields are only specified at layergroup creation time
 - Upgrade tilelive to ~4.4.2
 - Upgrade generic-pool to ~2.0.3

# Version 0.11.1
2013-04-03

 - Drop tilelive-mapnik internal cache

# Version 0.11.0
2013-04-02

 - Multilayer API changes (revert to 0.9.x behavior)
   - Configure interactivity at grid fetch time
   - Drop  /layergroup/:token/:z/:x/:y.grid.json route
   - Add /layergroup/:token/:layer/:z/:x/:y.grid.json route
   - Add /layergroup route to create maps via GET (#69)
   - Add map config to afterLayergroupCreate hook signature

# Version 0.10.0
2013-03-29

 - Multilayer API changes
   - Fully configure interactivity at layergroup (token) creation
   - Drop /layergroup/:token/:layer/:z/:x/:y.grid.json route
   - Add  /layergroup/:token/:z/:x/:y.grid.json route

# Version 0.9.2
2013-03-13

 - Change afterLayergroupCreate hook signature to take a full http
   request as first parameter

# Version 0.9.1
2013-03-01

 - Implement OPTIONS for multilayer endpoint
 - Add "test" make target (alias to "check")
 - Add support for global_cartocss_version in multilayer config
 - Allow req2param to install a RendererCache processor in the parameters
   (params.processRendererCache)
 - Per-map cache_buster encoding (#58)

# Version 0.9.0
2013-02-25

 - New multilayer API (#61)

# Version 0.8.5
2013-02-11

 - Do not assume any thrown exception is an Error (#65)
 - Clear both aut and non-auth render cache on style change (#59)
 - Require an 'interactivity' param when fetching grids (#55)
 - Allow configuring 'metatile' and 'buffer size' of renderer
 - Allow configuring renderer cache time to live (#35)

# Version 0.8.4
2013-01-30

 - Add dumpCacheStats method of Windshaft server
 - Log cache cleanup activity outcome

# Version 0.8.3
2013-01-28

 - Enhance run_tests.sh to allow running single tests and skipping preparation
 - Return status code 400 on POST STYLE and GET STYLE errors
 - Require grainstore ~0.10.10

# Version 0.8.2
2012-12-20

 - Require tilelive-mapnik 0.3.3-cdb2 to fix bug with utf grid cache
   http://github.com/Vizzuality/Windshaft-cartodb/issues/67

# Version 0.8.1
2012-12-19

 - Add X-Windshaft-Cache header
 - Require grainstore ~0.10.8 for better 2.0.0 -> 2.1.0 transforms


# Version 0.8.0
2012-11-14

 - API: add "style_convert" parameter to GET /style
 - Support geometry-type based rendering (#11)

# Version 0.7.1
2012-10-30

 - Allow sql queries to end with a semicolon
 - Added CORS headers to OPTIONS method
 - More enhancements to the benchmark.js script
 - Properly handle async nature of mml_builder construction (#51)

# Version 0.7.0
2012-10-19

 - API: add "style_" prefix to "version" and "convert" parameters
 - Enhancements to the benchmark.js script

# Version 0.6.2
2012-10-11

 - Log all error responses to console
 - Provide a sendError method to subclasses

# Version 0.6.1
2012-10-09

 - Fix getVersion reporting of grainstore version

# Version 0.6.0
2012-10-08

 - CartoCSS version control
  - Include version in GET /style response
  - Support version and convert parameters in POST /style request
  - Add /version entry point
  - Autodetect target mapnik version and let config override it

# Version 0.5.8
2012-09-28

 - Automated localization of external resources referenced in carto
 - Send 400 response status on GET tile errors
 - Added support for OPTIONS method in tile_style to be able to
   change styles from a javascript client

# Version 0.5.7
2012-09-03

 - Include database username in renderer cache key (#42).
 - Allow req2param to install an XML processor in the parameters
 - Less verbose error messages
 - Send 401 on authentication failure and 404 on table not found (#30)

# Version 0.5.6
2012-08-07

 - Add beforeStateChange called on POST and DELETE style request

# Version 0.5.5
2012-08-07

 - Use custom tilelive-mapnik to workaround ever-growing memory use
 - Expose setStyle and delStyle methods
 - Add afterStyleChange and afterStyleDelete callbacks

# Version 0.5.4
2012-08-01

 - Enable metatiling (4x4) speeding up 5x4 viewport fillups by ~2.5 (#12)
 - Shrinkwrap node-mapnik 0.7.9, fixing the garbage collection issue (#32)

# Version 0.5.3
2012-07-25

This release drops the requirement of a field already in epsg:3857
(aka "the_geom_webmercator");

 - Raise grainstore dependency to ~0.3.1 to allow for safe
   wgs84 to webmercator reprojection in mapnik.
 - Update tests to use mapnik reprojection.
 - Improve testing tool to accept tolerances
 - Shrinkwrap carto 0.8.1 and mapnik-reference 3.1.0

# Version 0.5.2
2012-07-20

 - Node 0.8 support
 - Raise tilelive dependency to ~4.3.1

# Version 0.5.1
2012-07-12

 - Raise underscore dependency to ~1.3
 - Loosen grainstore dependency to >= 0.2.3 < 0.4
 - Loosen hiredis dependency to ~0.1.12

# Version 0.5.0
2012-07-05

 NOTE: this release drops support for node-0.4.x

 - Requires node-0.6 (#10)
 - Add npm-shrinkwrap.json file to lock dependencies versions
 - Add support for mapnik 2.1.x (#14)
 - Stop depending on the tilelive-mapnik-cartodb fork of tilelive-mapnik (#26)

# Version 0.4.8
2012-07-04

 - Encode dependency on node-0.4
 - Raise express dependency to 2.5.11 (supports node-0.6)
 - Prepare code to support express-3.0
 - Redis dependency raised from 0.6.7 to 0.7.2 (supports node-0.8)
 - Require grainstore 0.2.3  (supports node-0.8)
 - Require zlib module as a workaround to "express"
   requiring a version of "connect" which doesn't do so
   while it should (https://github.com/senchalabs/connect/issues/613)
 - Testsuite enhancements
   - Read connection params from environment also at preparation time
   - Better handling of database preparation failures
   - Require mocha 1.2.1 as 1.2.2 doesn't work with node-0.4
     See https://github.com/visionmedia/mocha/issues/489

# Version 0.4.7
2012-06-26

 - Testsuite enhancements
   - Run on "make check"
   - Ported to mocha
   - Do not hang anymore
   - Fix invalid MML syntax
   - More verbose failures
 - Improved documentation
 - Raise grainstore dependency to 0.2.2

# Version 0.4.6
2012-05-07

# Version 0.4.5
2012-04-23

# Version 0.4.4
2012-04-01

# Version 0.4.3
2011-12-14

# Version 0.4.2
2011-12-09

# Version 0.4.1
2011-12-09

# Version 0.4.0
2011-12-08

# Version 0.3.2
2011-11-30

# Version 0.3.1
2011-11-25

# Version 0.3.0
2011-10-13

# Version 0.2.6
2011-10-07

# Version 0.2.5
2011-10-07

# Version 0.2.4
2011-10-07

# Version 0.2.3
2011-10-07

# Version 0.2.1
2011-10-07

# Version 0.0.11
2011-09-20

# Version 0.0.10
2011-09-20

# Version 0.0.9
2011-09-20

# Version 0.0.8
2011-09-14

# Version 0.0.7
2011-09-14

# Version 0.0.6
2011-09-14

# Version 0.0.5
2011-09-06

# Version 0.0.4
2011-09-04

# Version 0.0.3
2011-09-04

# Version 0.0.2
2011-09-04
