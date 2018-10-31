#!/bin/bash

docker run  -it -v `pwd`:/srv carto/${1:-nodejs10-xenial-pg101} bash
