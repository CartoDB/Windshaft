require('../support/test_helper');

var assert = require('../support/assert');
var TestClient = require('../support/test_client');

function makeMapconfig(cartocss) {
    return {
        "version": "1.4.0",
        "layers": [
            {
                "type": 'mapnik',
                "options": {
                    "cartocss_version": '2.3.0',
                    "sql": [
                        'SELECT test_table.*, _prices.price FROM test_table JOIN (' +
                        '  SELECT 1 AS cartodb_id, 10.00 AS price',
                        '  UNION',
                        '  SELECT 2, 10.50',
                        '  UNION',
                        '  SELECT 3, 11.00',
                        '  UNION',
                        '  SELECT 4, 12.00',
                        '  UNION',
                        '  SELECT 5, 21.00',
                        ') _prices ON _prices.cartodb_id = test_table.cartodb_id'
                    ].join('\n'),
                    "cartocss": cartocss
                }
            }
        ]
    };
}

describe('turbo-cartocss regressions', function() {

    it('should accept // comments', function(done) {
        var cartocss = [
            "/** simple visualization */",
            "",
            "Map {",
            "  buffer-size: 256;",
            "}",
            "",
            "#county_points_with_population{",
            "  marker-fill-opacity: 0.1;",
            "  marker-line-color:#FFFFFF;//#CF1C90;",
            "  marker-line-width: 0;",
            "  marker-line-opacity: 0.3;",
            "  marker-placement: point;",
            "  marker-type: ellipse;",
            "  //marker-comp-op: overlay;",
            "  marker-width: [price];",
            "  [zoom=5]{marker-width: [price]*2;}",
            "  [zoom=6]{marker-width: [price]*4;}",
            "  marker-fill: #000000;",
            "  marker-allow-overlap: true;",
            "  ",
            "",
            "}"
        ].join('\n');
        var testClient = new TestClient(makeMapconfig(cartocss));
        testClient.createLayergroup(function(err) {
            assert.ok(!err, err);
            done();
        });
    });
});
