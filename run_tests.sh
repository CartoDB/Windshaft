#!/bin/sh

cd $(dirname $0)
BASEDIR=$(pwd)
cd -

# Must match module.exports.redis.port in config/environments/test.js
REDIS_PORT=`node -e "console.log(require('${BASEDIR}/config/environments/test.js').redis.port)"`

OPT_CREATE=yes # create the test environment
OPT_DROP=yes   # drop the test environment
OPT_COVERAGE=no

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
        elif test "$1" = "--with-coverage"; then
                OPT_COVERAGE=yes
                shift
                continue
        else
                break
        fi
done

if [ -z "$1" ]; then
        echo "Usage: $0 [<options>] <test> [<test>]" >&2
        echo "Options:" >&2
        echo " --nocreate        do not create the test environment on start" >&2
        echo " --nodrop          do not drop the test environment on exit" >&2
        echo " --with-coverage   use istanbul to determine code coverage" >&2
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

if test x"$OPT_COVERAGE" = xyes; then
  echo "Running tests with coverage"
  ./node_modules/.bin/istanbul cover node_modules/.bin/_mocha -- -u bdd -t 5000 ${TESTS}
else
  echo "Running tests"
  ./node_modules/.bin/_mocha -u bdd -t 5000 ${TESTS}
fi
ret=$?

#cleanup

exit $ret
