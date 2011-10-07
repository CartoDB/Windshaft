
var   assert      = require('../support/assert')
    , tests       = module.exports = {}
    , _           = require('underscore')
    , querystring = require('querystring')
    , fs          = require('fs')
    , th          = require(__dirname + '/../test_helper')
    , Windshaft = require(__dirname + '/../../lib/windshaft')
    , ServerOptions = require('../server_options')
    , http          = require('http')
    , Step          = require('step');


var cached_server = new Windshaft.Server(ServerOptions({lru_cache: true, lru_cache_size: 3}));
cached_server.listen(8765);


tests["first time a tile is request should not be cached"] = function() {
    assert.response(cached_server, {
        url: '/database/windshaft_test/table/test_table/6/31/24.png',
        method: 'GET'
    },{
        status: 200

    }, function(res) {
        assert.ok(res.header('X-Cache-hit') === undefined);
    });
}

tests["second time a tile is request should be cached"] = function() {

   var url = '/database/windshaft_test/table/test_table/6/31/24.png';
   var request = http.request({
            host: '127.0.0.1',
            port: cached_server.__port,
            path: url,
            method: 'GET'
    });
    request.on('response', function(res) {
        assert.response(cached_server, {
            url: url,
            method: 'GET'
        },{
            status: 200

        }, function(res) {
            assert.ok(res.header('X-Cache-hit') !== undefined);
        });
    });
}

tests["LRU tile should be removed"] = function() {

   var urls = ['/database/windshaft_test/table/test_table/6/31/24.png',
               '/database/windshaft_test/table/test_table/6/31/25.png',
               '/database/windshaft_test/table/test_table/6/31/26.png',
               '/database/windshaft_test/table/test_table/6/31/27.png'];


    function makeReq(url, callback) {

        var request = http.request({
            host: '127.0.0.1',
            port: cached_server.__port,
            path: url,
            method: 'GET'
        });
        request.on('response', callaback);
    
    }
    
    Step(
        function() {
            makeReq(urls[0], this);
        },
        function() {
            makeReq(urls[1], this);
        },
        function() {
            makeReq(urls[2], this);
        },
         function() {
            makeReq(urls[3], this);
        }, function() {
            assert.response(cached_server, {
            url: urls[0],
            method: 'GET'
            },{
                status: 200

            }, function(res) {
                assert.ok(res.header('X-Cache-hit') === undefined);
            });
        }
    )

}