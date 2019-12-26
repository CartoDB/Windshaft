#!/bin/bash

if [[ "$OSTYPE" == "darwin"* ]]; then
    export PKG_CONFIG_PATH=/usr/local/lib/pkgconfig:/opt/X11/lib/pkgconfig
fi

npm ci
