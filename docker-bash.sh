#!/bin/bash

docker run  -it -v `pwd`:/srv carto/${1:-nodejs10-xenial-pg101:postgis-2.4.4.5} bash
