var _ = require('underscore');
var Windshaft = require('../../lib/windshaft');


// sanity check
var ENV = process.argv[2]
if (ENV != 'development' && ENV != 'production'){
    console.error("\nnode app.js [environment]");
    console.error("environments: [development, production]\n");
    process.exit(1);
}

// set environment specific variables
global.settings     = require('../../config/settings');
global.environment  = require('../../config/environments/' + ENV);
_.extend(global.settings, global.environment);

var ServerOptions = require('../support/server_options.js');
var server = new Windshaft.Server(ServerOptions);

server.listen(global.environment.windshaft_port);
console.log("Windshaft tileserver started on port " + global.environment.windshaft_port);