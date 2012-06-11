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

```
./prepare_test
```

* If prepare_test fails, refer to instructions in
  fixtures/windshaft.test.sql
* Redis needs to be running and listening on port 6379 (the default).
  Flushing your redis database may be needed if you are developing.

Execution
---------

once database is configured, run the tests with expresso:

```
> expresso acceptance/server.js
> expresso unit/windshaft.test.js
> expresso unit/render_cache.test.js
```

Notes
-----
* tests do not cause an exit of the main node event loop, and so
  need to be exited using ctrl-c.
* expresso might be installed in ../node_modules/expresso/bin
* performance tests are currently broken. Need removal or fixing.
