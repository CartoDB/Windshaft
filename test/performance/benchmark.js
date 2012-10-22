#!/usr/bin/env node

// small benchmark to execute with nodejs

var http = require('http')
var url = require('url');
var fs = require('fs');
var me = process.argv[1];

function usage(exit_code) {
  console.log("Usage: " + me + " [OPTIONS] <example_tile_url>");
  console.log("Options:");
  console.log(" -v                      increment verbosity by 1 (defaults to 0)");
  console.log(" --help                  print this help");
  console.log(" --key <string>          map authentication key (none)");
  console.log(" -n, --requests <num>    Maximum number of requests to send (1000)");
  console.log(" -C, --cached <num>[@url]");
  console.log("                         Viewport requests using same cache_buster value (20)");
  console.log("                         If an url is given it will be used to fetch");
  console.log("                         the cache_buster value.");
  console.log(" -c, --concurrent <num>  number of concurrent requests (20)");
  console.log(" -t, --timelimit <num>   Maximum number of seconds to spend for benchmarking (0)");
  console.log(" --vp-size <num>x<num>   tiles per col, line in user viewport (5x4)");
  console.log(" --zoom-levels <num>     number of zoom levels to span for each user");
  console.log(" --grid                  also fetch an utf8grid for each tile");
  process.exit(exit_code);
}

process.argv.shift(); // this will be "node" (argv[0])
process.argv.shift(); // this will be the script name  (argv[1])

var verbose = 0;
var urltemplate;
var map_key;
var cached_requests = 20;
var cache_buster_url;
var N = cached_requests*50; // number of requests (50 full viewports)
var concurrency = cached_requests; // number of concurrent requests
var cols = 5;  
var lines = 4;
var zlevs = 2; 
var fetch_grid = false;
var idletime = 0; // in seconds (TODO: parametrize)
var timelimit = 0;
var users = 1;

var arg;
while ( arg = process.argv.shift() ) {
  if ( arg == '-v' ) {
    ++verbose;
  }
  else if ( arg == '--key' ) {
    map_key=process.argv.shift();
  }
  else if ( arg == '--cached' || arg == '-C' ) {
    arg = process.argv.shift().split('@');
    cached_requests = parseInt(arg[0]);
    if ( arg[1] ) cache_buster_url = arg[1];
  }
  else if ( arg == '--timelimit' || arg == '-t' ) {
    timelimit = parseInt(process.argv.shift());
  }
  else if ( arg == '--users' ) {
    users = parseInt(process.argv.shift());
  }
  else if ( arg == '--grid' ) {
    fetch_grid=true;
  }
  else if ( arg == '--requests' || arg == '-n' ) {
    N = parseInt(process.argv.shift());
  }
  else if ( arg == '--vp-size' ) {
    arg = process.argv.shift();
    var parsed = arg.match(/([0-9]*)x([0-9]*)/);
    cols = parseInt(parsed[1]);
    lines = parseInt(parsed[2]);
  }
  else if ( arg == '--zoom-levels' ) {
    zlevs = parseInt(process.argv.shift());
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

var start_time = Date.now();
function end() {
    var final_time = Date.now();
    var total_response_time = final_time - start_time;
    var nreqs = ok+error;
    var rps = nreqs * 1000 / total_response_time;
    console.log("");
    console.log("Server Host:          ", urlparsed.host);
    console.log("Template URL (path):  ", urlparsed.pathname);
    console.log("");
    console.log("Viewport size:        ", cols + "x" + lines);
    console.log("Zoom levels:          ", zlevs);
    console.log("Viewports per cache:  ", cached_requests);
  if ( cache_buster_url ) 
    console.log("Cache buster url:     ", cache_buster_url);
    console.log("Simulated users:      ", users);
    console.log("Concurrency Level:    ", concurrency);
    console.log("");
    console.log("Complete requests:    ", ok);
    console.log("X-Cache hits:         ", xchits, " (" + Math.round((xchits/ok)*100) + "%)" );
    console.log("X-Varnish hits:       ", xvhits, " (" + Math.round((xvhits/ok)*100) + "%)" );
    console.log("Application hits:     ", ok-xchits-xvhits, " (" + Math.round(((ok-xchits-xvhits)/ok)*100) + "%)" );
    console.log("Hits summary:         ", xchits, "-", xvhits, "-", (ok-xchits-xvhits));
    console.log("");
    console.log("Failed requests:      ", error);
    console.log("");
    console.log("Requests per second:  ", Math.round(rps*100)/100, '[#/sec] (mean)');
    console.log("");
    process.exit(0);
}

var ok = 0;
var xchits = 0; // X-Cache hits
var xvhits = 0; // X-Varnish hits
var error = 0;

var requests_per_viewport = cols * lines * ( fetch_grid ? 2 : 1 );

http.globalAgent.maxSockets = concurrency;

if ( timelimit ) {
  setTimeout(function() { 
    console.log("Interrupting after " + timelimit + " seconds");
    end();
  }, timelimit*1000);
}

function fetchTileOrGrid(url, callback)
{
  http.get(url, function(res) {
    res.body = '';
    if ( res.statusCode != 200 ) {
      res.on('data', function(chunk) {
        // Save only first chunk, to reduce cost of the operation
        if ( res.body.length == 0 ) res.body += chunk;
      });
    }
    res.on('end', function() {
      if ( res.statusCode == 200 ) {
        var xcache = res.headers['x-cache'];
        var xvarnish = res.headers['x-varnish'];
        if ( xcache && xcache.match(/hit/i) ) ++xchits;
        else {
          if ( xvarnish && xvarnish.match(/ /) ) ++xvhits;
        }
        if ( verbose > 2 ) {
          console.log("X-Cache: " + xcache);
          console.log("X-Varnish: " + xvarnish);
        }
        ++ ok;
        callback(0);
      }
      else {
        console.log(res.statusCode + ' ' + url + ' ' + res.body);
        ++ error;
        callback();
      }
    });
  }).on('error', function(e) {
      console.log('unknown (http) error');
      ++ error;
      callback();
  });
}

function fetchViewport(x0, y0, z, cache_buster, callback)
{
  var im = fetch_grid ? 2 : 1;
  var waiting = requests_per_viewport;

  for (var xs=0; xs<cols; ++xs) {
    var x = x0+xs;
    for (var ys=0; ys<lines; ++ys) {
      var y = y0+ys;
      for (var i=0; i<im; ++i) {

        //console.log("Fetching " + z + "/" + x + "/" + y);
        var nurlobj = url.parse(urltemplate, true);
        delete nurlobj.search; // or url.format will not use urlparsed.query
        nurlobj.pathname = nurlobj.pathname.replace('{z}', z).replace('{x}', x).replace('{y}', y);
        if ( fetch_grid && i%2 ) {
          nurlobj.pathname = nurlobj.pathname.replace('.png', '.grid.json');
        }
        nurlobj.query = nurlobj.query || {};
        nurlobj.query['cache_buster'] = cache_buster;

        var nurl = url.format(nurlobj);

        fetchTileOrGrid(nurl, function() {
          if ( ! --waiting ) callback();
        });
      }
    }
  }
}

var now = Date.now();
var cbprefix = 'wb_' + process.env.USER + '_' + process.pid + "_"; 
var zstart = 3; // FIXME: make configurable
var vpcount = 0;

function fetchCacheBusterValue(callback)
{
    if ( ! cache_buster_url ) {
      var cb = cbprefix + ( now + Math.floor(vpcount/cached_requests) );
      callback(null, cb);
      return;
    } 

    http.get(cache_buster_url, function(res) {
      res.body = '';
      res.on('data', function(chunk) { res.body += chunk; });
      res.on('end', function() {
        if ( res.statusCode == 200 ) {
          callback(null, res.body);
        }
        else {
          callback(new Error(res.body));
        }
      });
    }).on('error', function(e) {
      callback(e);
    });

}

function fetchNextViewport() {

    if ( vpcount * requests_per_viewport * users >= N ) end();
    // TODO: use timeout as another exit point ?

    // update zoom level 
    var z = zstart + vpcount % zlevs;

    // update cache_buster 
    fetchCacheBusterValue(function(err, cb) {

      if ( err ) {
        console.log("Error fetching cache_buster value: " + err);
        cb = 0; // arbitrary value
      }

      // update vpcount
      ++vpcount;

      var users_left = users;

      for (var u=0; u<users; ++u) {

        if ( verbose ) {
          console.log("User " + u + " fetching viewport " + vpcount + " at zoom level " + z + " with cache_buster " + cb);
        }

        fetchViewport(0, 0, z, cb, function() {
          // fetch next viewport in idletime seconds
          if ( ! --users_left ) setTimeout(fetchNextViewport, idletime*1000);
        });

      }

    });
}


fetchNextViewport();

process.on('SIGINT', end);
