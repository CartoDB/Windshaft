all:
	npm install

clean:
	rm -rf node_modules/*

check-local:
	npm test

check-submodules:
	for sub in grainstore; do \
		test -e node_modules/$${sub} && make -C node_modules/$${sub} check; \
	done

check-full: check-local check-submodules

check: check-local
test: check-local
