var   _             = require('underscore')
    , th            = require('../support/test_helper.js')
    , assert        = require('assert')
    , Windshaft     = require('../../lib/windshaft')
    , serverOptions = require('../support/server_options')
    , tests         = module.exports = {};

suite('windshaft', function() {

    test('true',  function() {
        assert.equal(global.environment.name, 'test');
    });

    test('can instantiate a Windshaft object (configured express instance)',  function(){
        var ws = new Windshaft.Server(serverOptions);
        assert.ok(ws);
    });

    test('can spawn a new server on the global listen port',  function(done){
        var ws = new Windshaft.Server(serverOptions);
        ws.listen(global.environment.windshaft_port, function() {
          assert.ok(ws);
          ws.close(done); /* allow proper tear down */
        });
    });

    test('throws exception if incorrect options passed in',  function(){
        assert.throws(
            function(){
                var ws = new Windshaft.Server({unbuffered_logging:true});
            }, /Must initialise Windshaft with a base URL and req2params function/
        );
    });

    test('options are set on main windshaft object',  function(){
        var ws = new Windshaft.Server(serverOptions);
        assert.ok(_.isFunction(ws.req2params));
        assert.equal(ws.base_url, '/database/:dbname/table/:table');
    });

});
