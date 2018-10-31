#!/bin/bash

docker run -v `pwd`:/srv carto/${1:-nodejs10-xenial-pg101} bash run_tests_docker.sh && \
    docker ps --filter status=dead --filter status=exited -aq | xargs -r docker rm -v
