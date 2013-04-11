#!/bin/sh

# Must match module.exports.redis.port in config/environments/test.js
# TODO: read from there
REDIS_PORT=6333

OPT_CREATE=yes # create the test environment
OPT_DROP=yes   # drop the test environment

cd $(dirname $0)
BASEDIR=$(pwd)
cd -

cleanup() {
  if test x"$OPT_DROP" = xyes; then
    if test x"$PID_REDIS" = x; then
      PID_REDIS=$(cat ${BASEDIR}/redis.pid)
      if test x"$PID_REDIS" = x; then
        echo "Could not find a test redis pid to kill it"
        return;
      fi
    fi
    echo "Cleaning up"
    kill ${PID_REDIS}
  fi
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

while [ -n "$1" ]; do
        if test "$1" = "--nodrop"; then
                OPT_DROP=no
                shift
                continue
        elif test "$1" = "--nocreate"; then
                OPT_CREATE=no
                shift
                continue
        else
                break
        fi
done

if [ -z "$1" ]; then
        echo "Usage: $0 [<options>] <test> [<test>]" >&2
        echo "Options:" >&2
        echo " --nocreate   do not create the test environment on start" >&2
        echo " --nodrop     do not drop the test environment on exit" >&2
        exit 1
fi

TESTS=$@

if test x"$OPT_CREATE" = xyes; then
  echo "Starting redis on port ${REDIS_PORT}"
  echo "port ${REDIS_PORT}" | redis-server - > ${BASEDIR}/test.log &
  PID_REDIS=$!
  echo ${PID_REDIS} > ${BASEDIR}/redis.pid

  echo "Preparing the environment"
  cd ${BASEDIR}/test; sh prepare_test || die "database preparation failure"; cd -
fi

PATH=node_modules/.bin/:$PATH

echo "Running tests"
mocha -u tdd ${TESTS}
ret=$?

cleanup

exit $ret
