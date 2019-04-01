#!/bin/bash

echo "*********************"
echo "To install Node.js, run:"
echo "/src/nodejs-install.sh"
echo "Use NODEJS_VERSION env var to select the Node.js version"
echo " "
echo "To start postgres, run:"
echo "/etc/init.d/postgresql start"
echo "*********************"
echo " "

docker run  -it -v `pwd`:/srv carto/nodejs-xenial-pg101:latest bash
