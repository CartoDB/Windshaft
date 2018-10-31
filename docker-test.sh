#!/bin/bash

usage() {
    echo "Usage: $0 [<nodejs_version>]"
    exit 1
}

echo "$0 $1"

NODEJS_VERSION=${1-nodejs10}

if [ "$NODEJS_VERSION" = "nodejs10" ];
then
    DOCKER='nodejs10-xenial-pg101:postgis-2.4.4.5'
elif [ "$NODEJS_VERSION" = "nodejs6" ];
then
    DOCKER='nodejs6-xenial-pg101:postgis-2.4.4.5'
else
    usage
fi

docker run -v `pwd`:/srv carto/${DOCKER} bash run_tests_docker.sh ${NODEJS_VERSION} && \
    docker ps --filter status=dead --filter status=exited -aq | xargs -r docker rm -v
