Version 0.13.4
2013-09-04

 - Fix race condition with external resources (#82)

Version 0.13.3
2013-09-03

 - Upgrade tilelive-mapnik to use eio-2.1.0
 - Enable travis-ci

Version 0.13.2
2013-08-13

 - Rewrite mapnik XML parsing error to start with style name (#73)
 - Fix error on empty CartoCSS 

Version 0.13.1
2013-07-18

 - Do not print profile to stdout (use log_format for that)
 - Include renderer build time to profile
 - Do not re-check layergroup configs with no interaction
 - Log full layergroup config with resulting token on creation (#80)

Version 0.13.0
2013-07-16

 - Add support for profiling requests

Version 0.12.10
2013-07-16

 - Improve error message on blank CartoCSS in multilayer config

Version 0.12.9
2013-07-04

 - Do not assume already-tested layergroup config was good (#79)

Version 0.12.8
2013-06-28

 - Allow setting layergroup token ttl via config variable
   grainstore.default_layergroup_ttl 
 - Only check layergroup configuration when first seen (#77)
 - Use tile 30/0/0 for testing layergroups, override with maxzoom (#78)

Version 0.12.7
2013-06-26

 - Do not confuse single layergroup creation errors with multiple errors

Version 0.12.6
2013-06-21

 - Try fetching tile and grids on layergroup creation, early reporting errors

Version 0.12.5
2013-06-12

 - Redis moved to a devDependency, and upgraded to ~0.8.3
 - Grainstore dependency raised to ~0.13.4, fixing possible deadlocks
   during map styles gc operations.

Version 0.12.4
2013-06-06

 - Grainstore dependency raised to ~0.13.3

Version 0.12.3
2013-05-29

 - Do not confuse colors with layer names (#72)

Version 0.12.2
2013-05-29

 - Fix handling of layer name placeholder in multi-section CSS (#71)

Version 0.12.1
2013-05-21

 - Add possibility to specify a literal cache_buster value in benchmark.js
 - Allow Content-Type with encoding on /layergroup POST (#70)

Version 0.12.0
2013-04-04

 - Multilayer API changes
   - Interactivity layers are referenced by index (0-based)
   - Interactivity fields are only specified at layergroup creation time
 - Upgrade tilelive to ~4.4.2
 - Upgrade generic-pool to ~2.0.3

Version 0.11.1
2013-04-03

 - Drop tilelive-mapnik internal cache

Version 0.11.0
2013-04-02

 - Multilayer API changes (revert to 0.9.x behavior)
   - Configure interactivity at grid fetch time
   - Drop  /layergroup/:token/:z/:x/:y.grid.json route
   - Add /layergroup/:token/:layer/:z/:x/:y.grid.json route
   - Add /layergroup route to create maps via GET (#69)
   - Add map config to afterLayergroupCreate hook signature 

Version 0.10.0
2013-03-29

 - Multilayer API changes
   - Fully configure interactivity at layergroup (token) creation
   - Drop /layergroup/:token/:layer/:z/:x/:y.grid.json route
   - Add  /layergroup/:token/:z/:x/:y.grid.json route

Version 0.9.2
2013-03-13

 - Change afterLayergroupCreate hook signature to take a full http
   request as first parameter

Version 0.9.1
2013-03-01

 - Implement OPTIONS for multilayer endpoint
 - Add "test" make target (alias to "check")
 - Add support for global_cartocss_version in multilayer config
 - Allow req2param to install a RendererCache processor in the parameters
   (params.processRendererCache)
 - Per-map cache_buster encoding (#58)

Version 0.9.0
2013-02-25

 - New multilayer API (#61)

Version 0.8.5
2013-02-11

 - Do not assume any thrown exception is an Error (#65)
 - Clear both aut and non-auth render cache on style change (#59)
 - Require an 'interactivity' param when fetching grids (#55)
 - Allow configuring 'metatile' and 'buffer size' of renderer
 - Allow configuring renderer cache time to live (#35)

Version 0.8.4
2013-01-30

 - Add dumpCacheStats method of Windshaft server
 - Log cache cleanup activity outcome

Version 0.8.3
2013-01-28

 - Enhance run_tests.sh to allow running single tests and skipping preparation
 - Return status code 400 on POST STYLE and GET STYLE errors
 - Require grainstore ~0.10.10

Version 0.8.2
2012-12-20

 - Require tilelive-mapnik 0.3.3-cdb2 to fix bug with utf grid cache
   http://github.com/Vizzuality/Windshaft-cartodb/issues/67

Version 0.8.1
2012-12-19

 - Add X-Windshaft-Cache header
 - Require grainstore ~0.10.8 for better 2.0.0 -> 2.1.0 transforms


Version 0.8.0
2012-11-14

 - API: add "style_convert" parameter to GET /style
 - Support geometry-type based rendering (#11)

Version 0.7.1
2012-10-30

 - Allow sql queries to end with a semicolon
 - Added CORS headers to OPTIONS method
 - More enhancements to the benchmark.js script
 - Properly handle async nature of mml_builder construction (#51)

Version 0.7.0
2012-10-19

 - API: add "style_" prefix to "version" and "convert" parameters
 - Enhancements to the benchmark.js script

Version 0.6.2
2012-10-11

 - Log all error responses to console
 - Provide a sendError method to subclasses

Version 0.6.1
2012-10-09

 - Fix getVersion reporting of grainstore version

Version 0.6.0
2012-10-08

 - CartoCSS version control
  - Include version in GET /style response
  - Support version and convert parameters in POST /style request
  - Add /version entry point
  - Autodetect target mapnik version and let config override it

Version 0.5.8
2012-09-28

 - Automated localization of external resources referenced in carto
 - Send 400 response status on GET tile errors
 - Added support for OPTIONS method in tile_style to be able to
   change styles from a javascript client

Version 0.5.7
2012-09-03

 - Include database username in renderer cache key (#42).
 - Allow req2param to install an XML processor in the parameters
 - Less verbose error messages
 - Send 401 on authentication failure and 404 on table not found (#30)

Version 0.5.6
2012-08-07

 - Add beforeStateChange called on POST and DELETE style request

Version 0.5.5
2012-08-07

 - Use custom tilelive-mapnik to workaround ever-growing memory use 
 - Expose setStyle and delStyle methods
 - Add afterStyleChange and afterStyleDelete callbacks

Version 0.5.4
2012-08-01

 - Enable metatiling (4x4) speeding up 5x4 viewport fillups by ~2.5 (#12)
 - Shrinkwrap node-mapnik 0.7.9, fixing the garbage collection issue (#32)

Version 0.5.3
2012-07-25

This release drops the requirement of a field already in epsg:3857
(aka "the_geom_webmercator");

 - Raise grainstore dependency to ~0.3.1 to allow for safe 
   wgs84 to webmercator reprojection in mapnik.
 - Update tests to use mapnik reprojection.
 - Improve testing tool to accept tolerances
 - Shrinkwrap carto 0.8.1 and mapnik-reference 3.1.0 

Version 0.5.2
2012-07-20

 - Node 0.8 support
 - Raise tilelive dependency to ~4.3.1

Version 0.5.1
2012-07-12

 - Raise underscore dependency to ~1.3 
 - Loosen grainstore dependency to >= 0.2.3 < 0.4
 - Loosen hiredis dependency to ~0.1.12

Version 0.5.0
2012-07-05

 NOTE: this release drops support for node-0.4.x

 - Requires node-0.6 (#10) 
 - Add npm-shrinkwrap.json file to lock dependencies versions
 - Add support for mapnik 2.1.x (#14)
 - Stop depending on the tilelive-mapnik-cartodb fork of tilelive-mapnik (#26)

Version 0.4.8
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

Version 0.4.7
2012-06-26

 - Testsuite enhancements
   - Run on "make check"
   - Ported to mocha
   - Do not hang anymore
   - Fix invalid MML syntax
   - More verbose failures
 - Improved documentation 
 - Raise grainstore dependency to 0.2.2

Version 0.4.6
2012-05-07

Version 0.4.5
2012-04-23

Version 0.4.4
2012-04-01

Version 0.4.3
2011-12-14

Version 0.4.2
2011-12-09

Version 0.4.1
2011-12-09

Version 0.4.0
2011-12-08

Version 0.3.2
2011-11-30

Version 0.3.1
2011-11-25

Version 0.3.0
2011-10-13

Version 0.2.6
2011-10-07

Version 0.2.5
2011-10-07

Version 0.2.4
2011-10-07

Version 0.2.3
2011-10-07

Version 0.2.1
2011-10-07

Version 0.0.11
2011-09-20

Version 0.0.10
2011-09-20

Version 0.0.9
2011-09-20

Version 0.0.8
2011-09-14

Version 0.0.7
2011-09-14

Version 0.0.6
2011-09-14

Version 0.0.5
2011-09-06

Version 0.0.4
2011-09-04

Version 0.0.3
2011-09-04

Version 0.0.2
2011-09-04

