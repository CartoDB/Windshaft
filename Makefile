all:
	sh ./scripts/install.sh

clean:
	rm -rf node_modules/*

check: test

test:
	sh ./run_tests.sh ${RUNTESTFLAGS} test/unit/*.js test/unit/renderers/*.js test/integration/renderers/*.js test/acceptance/*.js

jshint:
	@./node_modules/.bin/jshint lib/

test-all: jshint test


.PHONY: test jshint
