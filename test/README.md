Windshaft tests
===============

Requirements
------------

 * Expresso - http://visionmedia.github.com/expresso/
   Used to drive the test runs
   You can install locally using ```npm install expresso```
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
but might need to be edited to fix access parameters.

Flushing your redis database may be needed if you are developing or after
changes to the environment configuration: ```redis-cli flushall```.

Execution
---------

once database is configured, run the tests with expresso:

```
cd ..
expresso test/unit/windshaft.test.js
expresso test/unit/render_cache.test.js
expresso test/acceptance/server.js
```

Notes
-----
 * tests do not cause an exit of the main node event loop, and so
   need to be exited using ctrl-c.
 * expresso might be installed in ../node_modules/expresso/bin
 * performance tests are currently broken. Need removal or fixing.
