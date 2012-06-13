#!/bin/sh

# Must match module.exports.redis.port in config/environments/test.js
REDIS_PORT=6333

echo "Starting redis on port ${REDIS_PORT}"
echo "port ${REDIS_PORT}" | redis-server - > test.log &
PID_REDIS=$!

echo "Preparing the database"
cd test; sh prepare_test >> test.log; cd -;

echo "Running unit tests"
expresso test/unit/windshaft.test.js \
         test/unit/render_cache.test.js

# This one doesn't work for me (yet) --strk
#expresso test/acceptance/server.js

kill ${PID_REDIS}
