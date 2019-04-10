#!/bin/bash

docker run -e "NODEJS_VERSION=${2}" -v `pwd`:/srv ${1} bash run_tests_docker.sh && \
    docker ps --filter status=dead --filter status=exited -aq | xargs docker rm -v
