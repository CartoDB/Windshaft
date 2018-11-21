#!/bin/bash

usage() {
    /etc/init.d/postgresql stop
    echo "Usage: $0 [nodejs10|nodejs6]"
    exit 1
}

echo "$0 $1"

# start PostgreSQL
/etc/init.d/postgresql start

echo "Node.js version:"
node -v

# install dependencies
NODEJS_VERSION=${1-nodejs10}

if [ "$NODEJS_VERSION" = "nodejs10" ];
then
    echo "npm version:"
    npm -v
    npm install
elif [ "$NODEJS_VERSION" = "nodejs6" ];
then
    npm install -g yarn@0.27.5
    yarn
else
    usage
fi

# run tests
npm test
