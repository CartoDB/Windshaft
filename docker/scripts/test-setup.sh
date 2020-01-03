#!/bin/bash

/etc/init.d/postgresql start

source /src/nodejs-install.sh

npm ci
npm test
