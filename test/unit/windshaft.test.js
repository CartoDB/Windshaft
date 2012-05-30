var   _             = require('underscore')
    , th            = require('../support/test_helper.js')
    , assert        = require('assert')
    , Windshaft     = require('../../lib/windshaft')
    , serverOptions = require('../support/server_options')
    , tests         = module.exports = {};

tests['true'] = function() {
    assert.eql(global.environment.name, 'test');
};

tests['can instantiate a Windshaft object (configured express instance)'] = function(){
    var ws = new Windshaft.Server(serverOptions);
    assert.ok(ws);
};

tests['can spawn a new server on the global listen port'] = function(){
    var ws = new Windshaft.Server(serverOptions);
    ws.listen(global.environment.windshaft_port);
    assert.ok(ws);
    ws.close(); /* allow proper tear down */
};

tests['throws exception if incorrect options passed in'] = function(){
    assert.throws(
        function(){
            var ws = new Windshaft.Server();
        }, /Must initialise Windshaft with a base URL and req2params function/
    );
};

tests['options are set on main windshaft object'] = function(){
    var ws = new Windshaft.Server(serverOptions);
    assert.ok(_.isFunction(ws.req2params));
    assert.eql(ws.base_url, '/database/:dbname/table/:table');
};
