SHELL=/bin/bash

all:
	@$(SHELL) ./scripts/install.sh

pre-install:
	@$(SHELL) ./scripts/check-node-canvas.sh

clean:
	@rm -rf node_modules/*

check: test

TEST_SUITE := $(shell find test/{acceptance,integration,unit} -name "*.js")
TEST_SUITE_UNIT := $(shell find test/unit -name "*.js")
TEST_SUITE_INTEGRATION := $(shell find test/integration -name "*.js")
TEST_SUITE_ACCEPTANCE := $(shell find test/acceptance -name "*.js")

test:
	@echo "***tests***"
	@$(SHELL) ./run_tests.sh ${RUNTESTFLAGS} $(TEST_SUITE)

test-acceptance:
	@echo "***acceptance tests***"
	@$(SHELL) ./run_tests.sh ${RUNTESTFLAGS} $(TEST_SUITE_ACCEPTANCE)

test-integration:
	@echo "***integration tests***"
	@$(SHELL) ./run_tests.sh ${RUNTESTFLAGS} $(TEST_SUITE_INTEGRATION)

test-unit:
	@echo "***unit tests***"
	@$(SHELL) ./run_tests.sh ${RUNTESTFLAGS} $(TEST_SUITE_UNIT)

eslint:
	@echo "***eslint***"
	@./node_modules/.bin/eslint lib/ test/

test-all: test eslint

coverage:
	@RUNTESTFLAGS=--with-coverage make test

.PHONY: pre-install test eslint coverage
