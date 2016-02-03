require('../../support/test_helper');

var assert        = require('../../support/assert');
var TestClient = require('../../support/test_client');

describe('widgets', function() {

   describe('formula', function() {
        function widgetsMapConfig(widgets) {
            return {
                version: '1.5.0',
                layers: [
                    {
                        type: 'mapnik',
                        options: {
                            sql: 'select * from populated_places_simple_reduced where pop_max > 0 and pop_max < 600000',
                            cartocss: '#layer0 { marker-fill: red; marker-width: 10; }',
                            cartocss_version: '2.0.1',
                            widgets: widgets
                        }
                    }
                ]
            };
        }

        var operations = {
            min: [10, 0],
            max: [599579, 0],
            count: [5822, 0],
            avg: [112246.00893163861, 0],
            sum: [653496264, 0]
        };

        Object.keys(operations).forEach(function(operation) {
            it('should do ' + operation + ' over column', function(done) {
                var widgets = {
                    pop_max_f: {
                        type: 'formula',
                        options: {
                            column: 'pop_max',
                            operation: operation
                        }
                    }
                };
                var testClient = new TestClient(widgetsMapConfig(widgets));
                testClient.getWidget(0, 'pop_max_f', function (err, result) {
                    assert.ok(!err, err);
                    assert.equal(result.operation, operation);
                    assert.equal(result.result, operations[operation][0]);
                    assert.equal(result.nulls, operations[operation][1]);

                    done();
                });
            });
        });

       it('does not require column for count formula', function(done) {
           var operation = 'count';
           var widgets = {
               pop_max_count_f: {
                   type: 'formula',
                   options: {
                       operation: operation
                   }
               }
           };
           var testClient = new TestClient(widgetsMapConfig(widgets));
           testClient.getWidget(0, 'pop_max_count_f', function (err, result) {
               assert.ok(!err, err);
               assert.equal(result.operation, operation);
               assert.equal(result.result, operations[operation][0]);
               assert.equal(result.nulls, operations[operation][1]);

               done();
           });
       });

    });

});
