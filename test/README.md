Windshaft tests
===============

NOTE: everything written in here should be taken care of by
      running "make check" from top-level dir

Requirements
------------

 * Mocha - http://visionmedia.github.com/mocha/
   Used to drive the test runs
   You can install globally using ```npm install -g mocha```
 * Redis - http://redis.io/
   Used to cache styles 
 * ImageMagick - http://www.imagemagick.org
   Compare tool is used to perform image comparison

Preparation
-----------

Edit configuration settings in the test environment configuration
../config/environments/test.js --  specifically the postgresql and
maybe redis slots.

Redis needs to be running and listening on port 6333 or
whatever you specified in the environment setting.

PostgreSQL 9.1+ needs to be running, listening on a TCP port and be
accessible as specified in the environment configuration.

Create a spatial database called "windshaft_test" and load the script
fixtures/windshaft.test.sql to initialize it. 
The script ```./prepare_test``` attempts to do all of it for you,
but needs the existance of a 'template_postgis' database.
Note that the spatial DB must be loaded with a version of PostGIS
providing 'AsBinary' and friends (including legacy.sql for PostGIS-2.0).

Flushing your redis database may be needed if you are developing or after
changes to the environment configuration: ```redis-cli -p 6333 flushall```.

Execution
---------

once database is configured, run the tests with mocha:

```
cd ..
mocha -u tdd test/unit/windshaft.test.js
mocha -u tdd test/unit/render_cache.test.js
mocha -u tdd test/acceptance/server.js
```

Notes
-----
 * mocha might be installed in ../node_modules/mocha/bin
 * performance tests are currently broken. Need removal or fixing.
