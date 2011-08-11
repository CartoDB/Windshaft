#!/usr/bin/env node

/*
* Windshaft loader
* ===============
*
* ./app.js [environment]
*
* environments: [development, production] 
*/

var _ = require('underscore');

// sanity check
var ENV = process.argv[2]
if (ENV != 'development' && ENV != 'production'){
  console.error("\n./app.js [environment]");
  console.error("environments: [development, production]\n");
  process.exit(1);
}

// set environment specific variables 
global.settings     = require(__dirname + '/config/settings')
global.environment  = require(__dirname + '/config/environments/' + ENV)
_.extend(global.settings, global.environment)
 
// boot 
require('./server').listen(global.environment.windshaft_port);





