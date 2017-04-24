require('../../support/test_helper');

var assert = require('assert');
var MapnikRendererFactory = require('../../../lib/windshaft/renderers/mapnik/factory');

describe('renderer-mapnik-factory', function() {
    it('should use default metatile value', function() {
        var factory = new MapnikRendererFactory({});
        assert.equal(factory.getMetatile('png'), 4);
    });

    it('should use provided metatile value', function() {
        var factory = new MapnikRendererFactory({mapnik: {
            metatile: 1
        }});
        assert.equal(factory.getMetatile('png'), 1);
    });

    it('should use provided formatMetatile value', function() {
        var factory = new MapnikRendererFactory({mapnik: {
            metatile: 1,
            formatMetatile: {
                png: 4
            }
        }});
        assert.equal(factory.getMetatile('png'), 4);
    });

    it('should use default buffer-size value', function() {
        var factory = new MapnikRendererFactory({});
        assert.equal(factory.getBufferSize('png'), 64);
    });

    it('should use provided buffer-size value', function() {
        var factory = new MapnikRendererFactory({ mapnik: {
            bufferSize: 128
        }});
        assert.equal(factory.getMetatile('png'), 128);
    });

    it('should use provided formatBufferSize value', function() {
        var factory = new MapnikRendererFactory({mapnik: {
            metatile: 64,
            formatBufferSize: {
                png: 128
            }
        }});
        assert.equal(factory.getMetatile('png'), 128);
    });

    it('should use provided buffer-size value', function() {
        var factory = new MapnikRendererFactory({mapnik: {
            metatile: 64,
            formatBufferSize: {
                png: 128
            }
        }});
        assert.equal(factory.getMetatile('mvt'), 64);
    });

});
