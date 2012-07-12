all:
	npm install

clean:
	rm -rf node_modules/*

check:
	npm test
