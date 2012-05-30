

var th          = require(__dirname + '/test_helper')
var Windshaft = require(__dirname + '/../lib/windshaft')
var ServerOptions = require('./../server_options')
if(process.argv[2] === 'cache') {
	console.log("LRU cache enabled");
	var cached_server = new Windshaft.Server(ServerOptions({lru_cache: true, lru_cache_size: 500}));
}
else {
	var cached_server = new Windshaft.Server(ServerOptions());
}
cached_server.listen(9090)
