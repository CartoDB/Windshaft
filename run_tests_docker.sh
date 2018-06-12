# start PostgreSQL
/etc/init.d/postgresql start

# install dependencies
npm install -g yarn@0.27.5
yarn

# run tests
npm test
