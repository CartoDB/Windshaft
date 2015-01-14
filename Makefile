all:
	npm install

clean:
	rm -rf node_modules/*

check-local:
	npm test

check: check-local
test: check-local
