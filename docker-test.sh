#!/bin/bash

docker run -e "NODEJS_VERSION=${1}" -v `pwd`:/srv carto/nodejs-xenial-pg101:latest bash run_tests_docker.sh && \
    docker ps --filter status=dead --filter status=exited -aq | xargs docker rm -v
