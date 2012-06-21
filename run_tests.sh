#!/bin/sh

# Must match module.exports.redis.port in config/environments/test.js
REDIS_PORT=6333

cleanup() {
	echo "Cleaning up"
	kill ${PID_REDIS}
}

cleanup_and_exit() {
	cleanup
	exit
}

die() {
	msg=$1
	echo "${msg}" >&2
	cleanup
	exit 1
}

trap 'cleanup_and_exit' 1 2 3 5 9 13

echo "Starting redis on port ${REDIS_PORT}"
echo "port ${REDIS_PORT}" | redis-server - > test.log &
PID_REDIS=$!

echo "Preparing the database"
cd test; sh prepare_test >> test.log || die "database preparation failure (see test.log)"; cd -;

echo "Running unit tests"
mocha --ignore-leaks -u tdd \
  test/unit/render_cache.test.js \
  test/unit/windshaft.test.js

#echo "Running acceptance tests"
# This one still fails, but in a different way
#mocha --ignore-leaks -u tdd test/acceptance/server.js

cleanup
