var   _             = require('underscore')
    , th            = require('../support/test_helper.js')
    , assert        = require('assert')
    , Windshaft     = require('../../lib/windshaft')
    , serverOptions = require('../support/server_options')
    , StatsClient = require('../../lib/windshaft/stats/client')
    , tests         = module.exports = {};

suite('windshaft', function() {

    var statsClientGetInstanceFn = StatsClient.getInstance;

    afterEach(function(done) {
        StatsClient.getInstance = statsClientGetInstanceFn;
        done();
    });

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

    test('different formats for postgis plugin error returns 400 as status code', function() {
        var ws = new Windshaft.Server(serverOptions);
        var expectedStatusCode = 400;
        assert.equal(
            ws.findStatusCode("Postgis Plugin: ERROR:  column \"missing\" does not exist\n"),
            expectedStatusCode,
            "Error status code for single line does not match"
        );

        assert.equal(
            ws.findStatusCode("Postgis Plugin: PSQL error:\nERROR:  column \"missing\" does not exist\n"),
            expectedStatusCode,
            "Error status code for multiline/PSQL does not match"
        );
    });

    test('finalizeGetTileOrGrid does not call statsClient when format is not supported', function() {
        var expectedCalls = 1, // it will call increment once for the general error
            invalidFormat = 'png2',
            invalidFormatRegexp = new RegExp(invalidFormat);
        mockStatsClientGetInstance({
            increment: function(label) {
                assert.equal(label.match(invalidFormatRegexp), null,
                    'Invalid format is getting into increment method');
                expectedCalls--;
            }
        });
        var ws = new Windshaft.Server(serverOptions);
        var reqMock = {
            params: {
                format: invalidFormat
            }
        };
        ws.sendError = function(){};
        ws.finalizeGetTileOrGrid('Unsupported format png2', reqMock, {}, null, null);

        StatsClient.getInstance =
        assert.equal(expectedCalls, 0, 'Unexpected number of calls to increment method');
    });

    test('finalizeGetTileOrGrid calls statsClient when format is supported', function() {
        var expectedCalls = 2, // general error + format error
            validFormat = 'png',
            validFormatRegexp = new RegExp(validFormat),
            formatMatched = false;
        mockStatsClientGetInstance({
            increment: function(label) {
                formatMatched = formatMatched || !!label.match(validFormatRegexp);
                expectedCalls--;
            }
        });
        var ws = new Windshaft.Server(serverOptions);
        var reqMock = {
            params: {
                format: validFormat
            }
        };
        ws.sendError = function(){}
        ws.finalizeGetTileOrGrid('Another error happened', reqMock, {}, null, null);

        assert.ok(formatMatched, 'Format was never matched in increment method')
        assert.equal(expectedCalls, 0, 'Unexpected number of calls to increment method');
    });

    function mockStatsClientGetInstance(instance) {
        StatsClient.getInstance = function() {
            return instance;
        };
    }

});
