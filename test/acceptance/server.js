// FLUSHALL Redis before starting

var   assert        = require('../support/assert')
    , tests         = module.exports = {}
    , _             = require('underscore')
    , querystring   = require('querystring')
    , fs            = require('fs')
    , th            = require('../support/test_helper')
    , Windshaft     = require('../../lib/windshaft')
    , ServerOptions = require('../support/server_options')
    , http          = require('http');

suite('server', function() {

    var server = new Windshaft.Server(ServerOptions);
    server.setMaxListeners(0);

    test("get call to server returns 200",  function(done){
        assert.response(server, {
            url: '/',
            method: 'GET'
        },{
            status: 200
        }, function() { done(); } );
    });

    test("get call to server returns 200",  function(done){
        assert.response(server, {
            url: '/',
            method: 'GET'
        },{
            status: 200
        }, function() { done(); } );
    });

    test("get'ing blank style returns default style",  function(done){
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/style',
            method: 'GET'
        },{
            status: 200,
            body: '{"style":"#test_table {marker-fill: #FF6600;marker-opacity: 1;marker-width: 8;marker-line-color: white;marker-line-width: 3;marker-line-opacity: 0.9;marker-placement: point;marker-type: ellipse;marker-allow-overlap: true;}"}'
        }, function() { done(); } );
    });

    test("post'ing no style returns 400 with errors",  function(done){
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/style',
            method: 'POST'
        },{
            status: 400,
            body: '{"error":"must send style information"}'
        }, function() { done(); } );
    });

    test("post'ing bad style returns 400 with error",  function(done){
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table_2/style',
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded' },
            data: querystring.stringify({style: '#test_table_2{backgxxxxxround-color:#fff;}'})
        },{
            status: 500,
            body: JSON.stringify(["style.mss:1:14 Unrecognized rule: backgxxxxxround-color"])
        }, function() { done(); } );
    });

    test("post'ing multiple bad styles returns 400 with error array",  function(done){
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table_2/style',
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded' },
            data: querystring.stringify({style: '#test_table_2{backgxxxxxround-color:#fff;foo:bar}'})
        },{
            status: 500,
            body: JSON.stringify(["style.mss:1:14 Unrecognized rule: backgxxxxxround-color","style.mss:1:41 Unrecognized rule: foo"])
        }, function() { done(); } );
    });

    test("post'ing good style returns 200",  function(done){
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table_3/style',
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded' },
            data: querystring.stringify({style: '#test_table_3{background-color:#fff;}'})
        },{
            status: 200
        }, function() { done(); } );
    });

    test("post'ing good style returns 200 then getting returns original style",  function(done){
        var style = '#test_table_3{background-color:#fff;}';

        // TODO: use Step ?

        assert.response(server, {
            url: '/database/windshaft_test/table/test_table_3/style',
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded' },
            data: querystring.stringify({style: style})
        },{
            status: 200
        }, function() {

            assert.response(server, {
                url: '/database/windshaft_test/table/test_table_3/style',
                method: 'GET'
            },{
                status: 200,
                body: JSON.stringify({style: style})
            }, function() { done(); } );

        });

    });

    test("deleting a style returns 200 and returns default therafter",  function(done){
        var style = '#test_table_3{background-color:#fff;}';
        var default_style = "#test_table_3 {marker-fill: #FF6600;marker-opacity: 1;marker-width: 8;marker-line-color: white;marker-line-width: 3;marker-line-opacity: 0.9;marker-placement: point;marker-type: ellipse;marker-allow-overlap: true;}";

        // TODO: use Step ?

        assert.response(server, {
            url: '/database/windshaft_test/table/test_table_3/style',
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded' },
            data: querystring.stringify({style: style})
        },{
            status: 200
        }, function() {

            assert.response(server, {
                url: '/database/windshaft_test/table/test_table_3/style',
                method: 'DELETE'
            },{
                status: 200
            }, function() {

                assert.response(server, {
                    url: '/database/windshaft_test/table/test_table_3/style',
                    method: 'GET'
                },{
                    status: 200,
                    body: JSON.stringify({style: default_style})
                }, function() { done(); } );

            });

        });


    });

    test("get'ing a tile with default style should return an expected tile",  function(done){
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
                done();
            });
        });
    });

    test("get'ing a tile with default style and sql should return a constrained tile",  function(done){
        var sql = querystring.stringify({sql: "SELECT * FROM test_table limit 2"});
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/13/4011/3088.png?' + sql,
            method: 'GET',
            encoding: 'binary'
        },{
            status: 200,
            headers: { 'Content-Type': 'image/png' }
        }, function(res){
            assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_limit_2.png',  function(err, similarity) {
                if (err) throw err;
                assert.deepEqual(res.headers['content-type'], "image/png");
                done();
            });
        });
    });

    test("get'ing a tile with url specified style should return an expected tile",  function(done){
        var style = querystring.stringify({style: "#test_table{marker-fill: blue;marker-line-color: black;}"});
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/13/4011/3088.png?' + style,
            method: 'GET',
            encoding: 'binary'
        },{
            status: 200,
            headers: { 'Content-Type': 'image/png' }
        }, function(res){
            assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_styled.png',  function(err, similarity) {
                if (err) throw err;
                assert.deepEqual(res.headers['content-type'], "image/png"); // TODO: isn't this a duplication ?
                done();
            });
        });
    });

    test("get'ing a tile with url specified style should return an expected tile twice",  function(done){
        var style = querystring.stringify({style: "#test_table{marker-fill: black;marker-line-color: black;}"});
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/13/4011/3088.png?' + style,
            method: 'GET',
            encoding: 'binary'
        },{
            status: 200,
            headers: { 'Content-Type': 'image/png' }
        }, function(res){
            assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_styled_black.png',  function(err, similarity) {
                if (err) throw err;
                assert.deepEqual(res.headers['content-type'], "image/png"); // TODO: isn't this a duplication ?
                done();
            });
        });
    });

    test("dynamically set styles in same session and then back to default",  function(done){
        var style = querystring.stringify({style: "#test_table{marker-fill: black;marker-line-color: black;}"});
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/13/4011/3088.png?' + style,
            method: 'GET',
            encoding: 'binary'
        },{
            status: 200,
            headers: { 'Content-Type': 'image/png' }
        }, function(res){
            assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_styled_black.png',  function(err, similarity) {
                if (err) throw err;
                assert.deepEqual(res.headers['content-type'], "image/png");

                // second style
                var style = querystring.stringify({style: "#test_table{marker-fill: black;marker-line-color: black;}"});
                assert.response(server, {
                    url: '/database/windshaft_test/table/test_table/13/4011/3088.png?' + style,
                    method: 'GET',
                    encoding: 'binary'
                },{
                    status: 200,
                    headers: { 'Content-Type': 'image/png' }
                }, function(res){
                    assert.imageEqualsFile(res.body, './test/fixtures/test_table_13_4011_3088_styled_black.png',  function(err, similarity) {
                        if (err) throw err;
                        assert.deepEqual(res.headers['content-type'], "image/png");

                        //back to default
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
                                done();
                            });
                        });
                    });
                });
            });
        });
    });

    test("get'ing a json with default style should return an grid",  function(done){
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/13/4011/3088.grid.json',
            method: 'GET'
        },{
            status: 200,
            headers: { 'Content-Type': 'text/javascript; charset=utf-8; charset=utf-8' }
        }, function(res){
            var expected_json = JSON.parse(fs.readFileSync('./test/fixtures/test_table_13_4011_3088.grid.json','utf8'));
            assert.deepEqual(JSON.parse(res.body), expected_json);
            done();
        });
    });


    test("get'ing a json with default style and single interactivity should return a grid",  function(done){
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/13/4011/3088.grid.json?interactivity=name',
            method: 'GET'
        },{
            status: 200,
            headers: { 'Content-Type': 'text/javascript; charset=utf-8; charset=utf-8' }
        }, function(res){
            var expected_json = {
                "1":{"name":"Hawai"},
                "2":{"name":"El Estocolmo"},
                "3":{"name":"El Rey del Tallarín"},
                "4":{"name":"El Lacón"},
                "5":{"name":"El Pico"}
            };
            assert.deepEqual(JSON.parse(res.body).data, expected_json);
            done();
        });
    });

    test("get'ing a json with default style and multiple interactivity should return a grid",  function(done){
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/13/4011/3088.grid.json?interactivity=name,address',
            method: 'GET'
        },{
            status: 200,
            headers: { 'Content-Type': 'text/javascript; charset=utf-8; charset=utf-8' }
        }, function(res){
            var expected_json = {
                "1":{"address":"Calle de Pérez Galdós 9, Madrid, Spain","name":"Hawai"},
                "2":{"address":"Calle de la Palma 72, Madrid, Spain","name":"El Estocolmo"},
                "3":{"address":"Plaza Conde de Toreno 2, Madrid, Spain","name":"El Rey del Tallarín"},
                "4":{"address":"Manuel Fernández y González 8, Madrid, Spain","name":"El Lacón"},
                "5":{"address":"Calle Divino Pastor 12, Madrid, Spain","name":"El Pico"}
            };
            assert.deepEqual(JSON.parse(res.body).data, expected_json);
            done();
        });
    });

    test("get'ing a json with default style and nointeractivity should return a grid",  function(done){
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/13/4011/3088.grid.json',
            method: 'GET'
        },{
            status: 200,
            headers: { 'Content-Type': 'text/javascript; charset=utf-8; charset=utf-8' }
        }, function(res){
            var expected_json = {};
            assert.deepEqual(JSON.parse(res.body).data, expected_json);
            done();
        });
    });



    test("get'ing a json with default style and sql should return a constrained grid",  function(done){
        var sql = querystring.stringify({sql: "SELECT * FROM test_table limit 2"})
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/13/4011/3088.grid.json?' + sql,
            method: 'GET'
        },{
            status: 200,
            headers: { 'Content-Type': 'text/javascript; charset=utf-8; charset=utf-8' }
        }, function(res){
            var expected_json = JSON.parse(fs.readFileSync('./test/fixtures/test_table_13_4011_3088_limit_2.grid.json','utf8'));
            assert.deepEqual(JSON.parse(res.body), expected_json);
            done();
        });
    });

    test("get'ing a tile with CORS enabled should return CORS headers",  function(done){
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/6/31/24.png',
            method: 'GET'
        },{
            status: 200,
            headers: {'Access-Control-Allow-Headers': 'X-Requested-With', 'Access-Control-Allow-Origin': '*'}
        }, function() { done(); });
    });

    test("beforeTileRender is called when the client request a tile",  function(done) {
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/6/31/24.png',
            method: 'GET'
        },{
            status: 200,
            headers: {'X-BeforeTileRender': 'called'}
        }, function() { done(); });
    });

    test("afterTileRender is called when the client request a tile",  function(done) {
        assert.response(server, {
            url: '/database/windshaft_test/table/test_table/6/31/24.png',
            method: 'GET'
        },{
            status: 200,
            headers: {'X-AfterTileRender': 'called', 'X-AfterTileRender2': 'called'}
        }, function() { done(); });
    });

});

