/etc/init.d/postgresql start
node -v
npm -v
npm install -g yarn@0.27.5
export NPROCS=1
export JOBS=1
export CXX=g++-4.9
yarn
export PGUSER=postgres
export POSTGIS_VERSION=2.4
npm test
