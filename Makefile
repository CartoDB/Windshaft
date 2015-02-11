all:
	npm install

clean:
	rm -rf node_modules/*

check-local:
	npm test

check: check-local
test: check-local

old-api-tests:
	sh ./run_tests.sh ${RUNTESTFLAGS} test/acceptance/server.js test/acceptance/server_gettile.js test/acceptance/server_png8_format.js