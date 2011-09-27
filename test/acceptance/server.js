// FLUSHALL Redis before starting

var   assert      = require('../support/assert')
    , tests       = module.exports = {}
    , _           = require('underscore')
    , querystring = require('querystring')
    , fs          = require('fs')
    , th          = require(__dirname + '/../test_helper')
    , Windshaft = require(__dirname + '/../../lib/windshaft')
    , serverOptions = require('../server_options')
    , server = new Windshaft.Server(serverOptions);

tests['true'] = function() {
    assert.ok(true);
};

tests["get call to server returns 200"] = function(){
    assert.response(server, {
        url: '/',
        method: 'GET'
    },{
        status: 200
    });
};

tests["get'ing blank style returns default style"] = function(){
    assert.response(server, {
        url: '/database/windshaft_test/table/test_table/style',
        method: 'GET'
    },{
        status: 200,
        body: '{"style":"#test_table {marker-fill: #FF6600;marker-opacity: 1;marker-width: 8;marker-line-color: white;marker-line-width: 3;marker-line-opacity: 0.9;marker-placement: point;marker-type: ellipse;marker-allow-overlap: true;}"}'
    });
};

tests["post'ing no style returns 400 with errors"] = function(){
    assert.response(server, {
        url: '/database/windshaft_test/table/test_table/style',
        method: 'POST'
    },{
        status: 400,
        body: '{"error":"must send style information"}'
    });
};

tests["post'ing bad style returns 400 with error"] = function(){
    assert.response(server, {
        url: '/database/windshaft_test/table/test_table_2/style',
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded' },
        data: querystring.stringify({style: '#test_table_2{backgxxxxxround-color:#fff;}'})
    },{
        status: 400,
        body: JSON.stringify(["style.mss:1:14 Unrecognized rule: backgxxxxxround-color"])
    });
};

tests["post'ing multiple bad styles returns 400 with error array"] = function(){
    assert.response(server, {
        url: '/database/windshaft_test/table/test_table_2/style',
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded' },
        data: querystring.stringify({style: '#test_table_2{backgxxxxxround-color:#fff;foo:bar}'})
    },{
        status: 400,
        body: JSON.stringify(["style.mss:1:14 Unrecognized rule: backgxxxxxround-color","style.mss:1:41 Unrecognized rule: foo"])
    });
};

tests["post'ing good style returns 200"] = function(){
    assert.response(server, {
        url: '/database/windshaft_test/table/test_table_3/style',
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded' },
        data: querystring.stringify({style: '#test_table_3{background-color:#fff;}'})
    },{
        status: 200
    });
};

tests["post'ing good style returns 200 then getting returns original style"] = function(){
    var style = '#test_table_3{background-color:#fff;}';

    assert.response(server, {
        url: '/database/windshaft_test/table/test_table_3/style',
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded' },
        data: querystring.stringify({style: style})
    },{
        status: 200
    });

    assert.response(server, {
        url: '/database/windshaft_test/table/test_table_3/style',
        method: 'GET'
    },{
        status: 200,
        body: JSON.stringify({style: style})
    });
};


tests["get'ing a tile with default style should return an expected tile"] = function(){
    assert.response(server, {
        url: '/database/windshaft_test/table/test_table/13/4011/3088.png',
        method: 'GET',
        encoding: 'binary'
    },{
        status: 200,
        headers: { 'Content-Type': 'image/png' }
    }, function(res){
        assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088.png',  function(err, similarity) {
            if (err) throw err;
            assert.deepEqual(res.headers['content-type'], "image/png");
        });
    });
};


tests["get'ing a json with default style should return an grid"] = function(){
    assert.response(server, {
        url: '/database/windshaft_test/table/test_table/13/4011/3088.grid.json',
        method: 'GET'
    },{
        status: 200,
        headers: { 'Content-Type': 'text/javascript; charset=utf-8; charset=utf-8' }
    }, function(res){
        var expected_json = JSON.parse(fs.readFileSync('./test/fixtures/test_table_13_4011_3088.grid.json','utf8'));
        assert.deepEqual(JSON.parse(res.body), expected_json);
    });
};


tests["get'ing a json with default style and sql should return a constrained grid"] = function(){
    var sql = querystring.stringify({sql: "SELECT * FROM test_table limit 2"})
    assert.response(server, {
        url: '/tiles/gadm4/6/31/24.grid.json?' + sql,
        method: 'GET'
    },{
        status: 200,
        headers: { 'Content-Type': 'text/javascript; charset=utf-8; charset=utf-8' }
    }, function(res){
        var expected_json = JSON.parse(fs.readFileSync('./test/fixtures/test_table_13_4011_3088.grid.json','utf8'));
        assert.deepEqual(JSON.parse(res.body), expected_json);
    });
};


//
//
//
//tests["get'ing a tile with default style and sql should return a constrained image"] = function(){
//    var sql = querystring.stringify({sql: "SELECT * FROM gadm4 WHERE name_2 = 'Murcia'"});
//    assert.response(server, {
//        headers: {host: 'vizzuality.localhost.lan'},
//        url: '/tiles/gadm4/6/31/24.png?' + sql,
//        method: 'GET'
//    },{
//        status: 200,
//        headers: { 'Content-Type': 'image/png' }
//    });
//};
//
//
//tests["get'ing a tile with default style and complex sql should return a constrained image"] = function(){
//    var sql = querystring.stringify({sql: "SELECT * FROM gadm4 WHERE name_2 = 'Murcia' AND id_1 > 950"})
//    assert.response(server, {
//        headers: {host: 'vizzuality.localhost.lan'},
//        url: '/tiles/gadm4/6/31/24.png?' + sql,
//        method: 'GET'
//    },{
//        status: 200,
//        headers: { 'Content-Type': 'image/png' }
//    });
//};
//
tests["get'ing a tile with CORS enabled should return CORS headers"] = function(){
    assert.response(server, {
        url: '/database/windshaft_test/table/test_table/6/31/24.png',
        method: 'GET'
    },{
        status: 200,
        headers: {'Access-Control-Allow-Headers': 'X-Requested-With', 'Access-Control-Allow-Origin': '*'}
    });
};