#!/usr/bin/env node

// small benchmark to execute with nodejs

var http = require('http')

if ( process.argv.length < 3 ) {
  console.error("Usage: " + process.argv[1] + " <baseurl> [<map_key>]");
  process.exit(1);
}

var baseurl = process.argv[2];
console.log("Baseurl is " + baseurl);
var baseurl_comps = baseurl.match(/(https?:\/\/)?([^:\/]*)(:([^\/]*))?(\/.*).*/);

var options = {
  host: baseurl_comps[2],
  port: baseurl_comps[4] ? baseurl_comps[4] : 8181,
  path: baseurl_comps[5] + '/{z}/{x}/{y}.png?cache_buster=0'
};

if ( process.argv.length > 3 ) {
  options.path += '&map_key=' + process.argv[3]; 
}

console.dir(options);

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

var N = 1000
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
    opt.path = opt.path.replace('{z}', 2).replace('{x}', randInt(0, 3)).replace('{y}', randInt(0, 3));
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
        }
      });
    }).on('error', function(e) {
        fail('unknown (http) error');
    });
}

