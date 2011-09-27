Windshaft tests
--

* Tests require you create a test database using the instructions in windshaft.test.sql
* As styles are cached in redis, flushing your redis database may be needed if you are developing.

once database is configured, run the tests with expresso:

> expresso test/acceptance/server.js (etc)
