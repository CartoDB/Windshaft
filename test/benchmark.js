// small benchmark to execute with nodejs

var http = require('http')

var options = {
  host: '10.0.0.11',
  port: 9090,
  path: '/database/windshaft_test/table/uasm_all_export/{z}/{x}/{y}.png'
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
    opt.path = opt.path.replace('{z}', 4).replace('{x}', randInt(0, 15)).replace('{y}', randInt(0, 15));
    //console.log(opt.path)
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

