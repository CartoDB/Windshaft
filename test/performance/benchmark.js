#!/usr/bin/env node

// small benchmark to execute with nodejs

var http = require('http')
var me = process.argv[1];

function usage(exit_code) {
  console.log("Usage: " + me + " [OPTIONS] <baseurl>");
  console.log("Options:");
  console.log(" -v                verbose operations (off)");
  console.log(" --key <string>    map authentication key (none)");
  console.log(" --requests <num>  number of requests to send (1000)");
  console.log(" --cached <num>    number of requests sharing same cache id (16)");
  process.exit(exit_code);
}

process.argv.shift(); // this will be "node" (argv[0])
process.argv.shift(); // this will be "benchmark.js" (argv[1])

var verbose = 0;
var baseurl;
var map_key;
var cached_requests = 16;
var N = 1000;

var arg;
while ( arg = process.argv.shift() ) {
  if ( arg == '-v' ) {
    ++verbose;
  }
  else if ( arg == '--key' ) {
    map_key=process.argv.shift();
  }
  else if ( arg == '--cached' ) {
    cached_requests=process.argv.shift();
  }
  else if ( arg == '--requests' ) {
    N = parseInt(process.argv.shift());
  }
  else if ( ! baseurl ) {
    baseurl = arg;
  }
  else {
    usage(1);
  }
}

if ( ! baseurl ) {
  usage(1);
}

console.log("Baseurl is " + baseurl);
var baseurl_comps = baseurl.match(/(https?:\/\/)?([^:\/]*)(:([^\/]*))?(\/.*).*/);

var options = {
  host: baseurl_comps[2],
  port: baseurl_comps[4] ? baseurl_comps[4] : 8181,
  path: baseurl_comps[5] + '/{z}/{x}/{y}.png?cache_buster={cb}'
};

if ( map_key ) options.path += '&map_key=' + map_key;

console.dir(options);
console.log("Requests per cache: " + cached_requests);

function randInt(min, max) {
    return min + Math.floor(Math.random()*(max- min +1));
}

var start_time = new Date().getTime();
function end() {
    var end_time = new Date().getTime();
    var t = (end_time - start_time)/1000;
    console.log("ok: ", ok)
    console.log("error: ", error)
    console.log("time: ", t);
    console.log("req/s: ", ok/t);
}

var ok = 0;
var error = 0;

function fail(msg) {
  console.log(msg);
  ++ error;
  if ( error + ok === N ) end();
}

function pass() {
  ++ ok;
  if ( error + ok === N ) end();
}

for(var i = 0; i < N; ++i) {
    var opt = {
        host: options.host,
        port: options.port,
        path: new String(options.path)
    };

    var z = 2;
    var x = randInt(0, 3);
    var y = randInt(0, 3);
    // update cache buster every 16 requests (TODO: use command line switch)
    var cb = Math.floor(i/cached_requests);

    opt.path = opt.path.replace('{z}', z).replace('{x}', x).replace('{y}', y).replace('{cb}', cb);
    if ( verbose ) console.log(' http://' + opt.host + ':' + opt.port + opt.path);

    //console.log(opt.path)
    http.get(opt, function(res) {
      res.body = '';
      res.on('data', function(chunk) {
        // Save only first chunk, to reduce cost of the operation
        if ( res.body.length == 0 ) res.body += chunk;
      });
      res.on('end', function() {
        if ( res.statusCode == 200 ) pass();
        else {
          fail(res.statusCode + ' http://' + opt.host + ':' + opt.port + opt.path + ' ' + res.body);
          process.exit(1);
        }
      });
    }).on('error', function(e) {
        fail('unknown (http) error');
    });
}

