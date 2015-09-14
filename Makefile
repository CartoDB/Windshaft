SHELL=/bin/bash

pre-install:
	@$(SHELL) ./scripts/check-node-canvas.sh

all:
	@$(SHELL) ./scripts/install.sh

clean:
	@rm -rf node_modules/*

check: test

test:
	@echo "***tests***"
	@$(SHELL) ./run_tests.sh ${RUNTESTFLAGS} \
		test/unit/*.js \
		test/unit/renderers/*.js \
		test/integration/renderers/*.js \
		test/acceptance/*.js

test-acceptance:
	@echo "***acceptance tests***"
	@$(SHELL) ./run_tests.sh ${RUNTESTFLAGS} \
		test/acceptance/*.js

test-integration:
	@echo "***integration tests***"
	@$(SHELL) ./run_tests.sh ${RUNTESTFLAGS} \
		test/integration/renderers/*.js

test-unit:
	@echo "***unit tests***"
	@$(SHELL) ./run_tests.sh ${RUNTESTFLAGS} \
		test/unit/*.js \
		test/unit/renderers/*.js

jshint:
	@echo "***jshint***"
	@./node_modules/.bin/jshint lib/ test/

test-all: jshint test

coverage:
	@RUNTESTFLAGS=--with-coverage make test

.PHONY: pre-install test jshint coverage
