#!/bin/bash

/etc/init.d/postgresql start

source /src/nodejs-install.sh

echo "Node.js version: "
node -v

echo "npm version: "
npm -v

echo "Clean install: "
npm ci
npm ls

# run tests
npm test
