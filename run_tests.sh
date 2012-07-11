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
cd test; sh prepare_test || die "database preparation failure"; cd -;

echo "Running tests"
mocha -u tdd \
  test/acceptance/server.js \
  test/unit/windshaft.test.js \
  test/unit/render_cache.test.js 


cleanup
