#!/usr/bin/env node

// small benchmark to execute with nodejs

var http = require('http')
var url = require('url');
var fs = require('fs');
var me = process.argv[1];

function usage(exit_code) {
  console.log("Usage: " + me + " [OPTIONS] <example_tile_url>");
  console.log("Options:");
  console.log(" -v                      verbose operations (off)");
  console.log(" --help                  print this help");
  console.log(" --key <string>          map authentication key (none)");
  console.log(" -n, --requests <num>    number of requests to send (1000)");
  console.log(" -C, --cached <num>      number of requests sharing same cache id (20)");
  console.log(" -c, --concurrent <num>  number of concurrent requests (20)");
  process.exit(exit_code);
}

process.argv.shift(); // this will be "node" (argv[0])
process.argv.shift(); // this will be the script name  (argv[1])

var verbose = 0;
var urltemplate;
var map_key;
var cached_requests = 20;
var N = cached_requests*50; // number of requests (50 full viewports)
var concurrency = cached_requests; // number of concurrent requests

var arg;
while ( arg = process.argv.shift() ) {
  if ( arg == '-v' ) {
    ++verbose;
  }
  else if ( arg == '--key' ) {
    map_key=process.argv.shift();
  }
  else if ( arg == '--cached' || arg == '-C' ) {
    cached_requests=process.argv.shift();
  }
  else if ( arg == '--requests' || arg == '-n' ) {
    N = parseInt(process.argv.shift());
  }
  else if ( arg == '--help' ) {
    usage(0);
  }
  else if ( arg == '-c' || arg == '--concurrent' ) {
    concurrency = parseInt(process.argv.shift());
  }
  else if ( ! urltemplate ) {
    urltemplate = arg;
  }
  else {
    usage(1);
  }
}

if ( ! urltemplate ) {
  usage(1);
}

var urlparsed = url.parse(urltemplate, true);
urlparsed.query = urlparsed.query || {};
delete urlparsed.search; // or url.format will not use urlparsed.query
var pathname_match = urlparsed.pathname.match(RegExp('(.*)/[0-9]+/[0-9]+/[0-9]+.png$', "i"));
if ( ! pathname_match ) {
  // For backward compatibility, add ZXY portion to url, if not found
  urlparsed.pathname += '/{z}/{x}/{y}.png';
} else {
  // Otherwise take the whole thing as a sample and convert ZXY
  // with the templated version
  //urlparsed.pathname += '/{z}/{x}/{y}.png';
  urlparsed.pathname = pathname_match[1];
  urlparsed.pathname += '/{z}/{x}/{y}.png';
}

if ( map_key ) {
  urlparsed.query['map_key'] = map_key;
}

urltemplate = url.format(urlparsed);

function randInt(min, max) {
    return min + Math.floor(Math.random()*(max- min +1));
}

var start_time = Date.now();
function end() {
    var end_time = Date.now();
    var t = (end_time - start_time)/1000;
    console.log("");
    console.log("Server Host:          ", urlparsed.host);
    console.log("");
    console.log("Requests per cache:   ", cached_requests);
    console.log("Template URL:         ", urltemplate);
    console.log("");
    console.log("Complete requests:    ", ok)
    console.log("Failed requests:      ", error)
    console.log("Concurrency Level:    ", concurrency);
    console.log("Time taken for tests: ", t, " seconds");
    console.log("Requests per second:: ", (Math.round(((ok+error)/t)*100)/100), '[#/sec] (mean)');
    console.log("");
    process.exit(0);
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

http.globalAgent.maxSockets = concurrency;
for(var i = 0; i < N; ++i) {

    var z = 3;
    var x = i%5; // TODO: make this configurable (5 horizontal tiles)
    var y = i%4; // TODO: make this configurable (4 vertical tiles)

    // update cache buster every "cached_requests" requests 
    var cb = Math.floor(i/cached_requests);

    var nurlobj = url.parse(urltemplate);
    nurlobj.pathname = nurlobj.pathname.replace('{z}', z).replace('{x}', x).replace('{y}', y);
    nurlobj.query = nurlobj.query || {};
    nurlobj.query['cache_buster'] = cb;

    var nurl = url.format(nurlobj);

    if ( verbose ) console.log("|+++|---> " + nurl);

    //console.log(opt.path)
    http.get(nurl, function(res) {
      res.body = '';
      if ( res.statusCode != 200 ) {
        res.on('data', function(chunk) {
          // Save only first chunk, to reduce cost of the operation
          if ( res.body.length == 0 ) res.body += chunk;
        });
      }
      res.on('end', function() {
        if ( res.statusCode == 200 ) pass();
        else {
          fail(res.statusCode + ' ' + nurl + ' ' + res.body);
          process.exit(1);
        }
      });
    }).on('error', function(e) {
        fail('unknown (http) error');
    });
}

var timeout = N * 1000;
setTimeout(function() { 
  console.log("Not finished after " + (timeout/1000) + " seconds, giving up");
  process.exit(1);
}, timeout);
