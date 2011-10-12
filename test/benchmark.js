// small benchmark to execute with nodejs

var http = require('http')

var options = {
  host: 'vizzuality.localhost.lan',
  port: 80,
  path: '/tiles/datos_agroguia_2/{z}/{x}/{y}.png?cache_buster=0&map_key=a9edf3d0d2edbcf55ad38ee5b23af1507b774a5b'
};

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
for(var i = 0; i < N; ++i) {
    var opt = {
        host: options.host,
        port: options.port,
        path: new String(options.path)
    };
    opt.path = opt.path.replace('{z}', 2).replace('{x}', randInt(0, 3)).replace('{y}', randInt(0, 3));
    console.log(opt.path)
    http.get(opt, function(res) {
        //console.log(ok + error);
        ok++;
        if(ok + error  === N) 
            end();
    }).on('error', function(e) {
        //console.log(ok + error);
        error ++;
        if(ok + error  === N) 
            end();
    });
}

