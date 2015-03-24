require('../../support/test_helper.js');

var assert = require('assert');
var Windshaft = require('../../../lib/windshaft');
var MapController = require('../../../lib/windshaft/controllers/map');
var serverOptions = require('../../support/server_options');
var StatsClient = require('../../../lib/windshaft/stats/client');

suite('windshaft', function() {

    var statsClientGetInstanceFn = StatsClient.getInstance;


    test('finalizeGetTileOrGrid does not call statsClient when format is not supported', function() {
        var expectedCalls = 2, // it will call increment once for the general error
            invalidFormat = 'png2',
            invalidFormatRegexp = new RegExp('invalid'),
            formatMatched = false;
        mockStatsClientGetInstance({
            increment: function(label) {
                formatMatched = formatMatched || !!label.match(invalidFormatRegexp);
                expectedCalls--;
            }
        });

        var ws = new Windshaft.Server(serverOptions);
        ws.sendError = function(){};

        var mapController = new MapController(ws, null);

        var reqMock = {
            params: {
                format: invalidFormat
            }
        };
        mapController.finalizeGetTileOrGrid('Unsupported format png2', reqMock, {}, null, null);

        assert.ok(formatMatched, 'Format was never matched in increment method');
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
        var reqMock = {
            params: {
                format: validFormat
            }
        };

        var ws = new Windshaft.Server(serverOptions);
        ws.sendError = function(){};

        var mapController = new MapController(ws, null);

        mapController.finalizeGetTileOrGrid('Another error happened', reqMock, {}, null, null);

        assert.ok(formatMatched, 'Format was never matched in increment method');
        assert.equal(expectedCalls, 0, 'Unexpected number of calls to increment method');
    });

    function mockStatsClientGetInstance(instance) {
        StatsClient.getInstance = function() {
            return instance;
        };
    }

    suiteTeardown(function(done) {
        StatsClient.getInstance = statsClientGetInstanceFn;
        done();
    });

});
