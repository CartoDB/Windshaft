'use strict';

require('../../support/test_helper');

var assert = require('assert');
var MapnikRendererFactory = require('../../../lib/windshaft/renderers/mapnik/factory');
var MapConfig = require('../../../lib/windshaft/models/mapconfig');

describe('renderer-mapnik-factory metatile', function() {

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
});

describe('renderer-mapnik-factory buffer-size', function() {
    var mapConfig = MapConfig.create({
        layers: [
            {
                type: 'plain',
                options: {
                    color: 'red'
                }
            },
            {
                type: 'plain',
                options: {
                    color: 'green'
                }
            },
            {
                type: 'plain',
                options: {
                    color: 'blue'
                }
            }
        ]
    });

    it('should use default buffer-size value', function() {
        var factory = new MapnikRendererFactory({});
        assert.equal(factory.getBufferSize(mapConfig,'png'), 64);
    });

    it('should use provided buffer-size value', function() {
        var factory = new MapnikRendererFactory({ mapnik: {
            bufferSize: 128
        }});
        assert.equal(factory.getBufferSize(mapConfig,'png'), 128);
    });

    it('should use provided formatBufferSize value', function() {
        var factory = new MapnikRendererFactory({mapnik: {
            bufferSize: 64,
            formatBufferSize: {
                png: 128
            }
        }});
        assert.equal(factory.getBufferSize(mapConfig,'png'), 128);
    });

    it('should use provided buffer-size value', function() {
        var factory = new MapnikRendererFactory({mapnik: {
            bufferSize: 64,
            formatBufferSize: {
                png: 128
            }
        }});
        assert.equal(factory.getBufferSize(mapConfig,'mvt'), 64);
    });

    it('should use value provided by mapConfig for png and mvt', function() {
        var mapConfig = MapConfig.create({
            buffersize: {
                png: 128,
                mvt: 0,
                'grid.json': 64
            },
            layers: [
                {
                    type: 'plain',
                    options: {
                        color: 'red'
                    }
           }]
        });
        var factory = new MapnikRendererFactory({mapnik: {
            bufferSize: 64,
            formatBufferSize: {
                png: 256,
                mvt: 256,
                'grid.json': 256
            }
        }});
        assert.equal(factory.getBufferSize(mapConfig,'png'), 128);
        assert.equal(factory.getBufferSize(mapConfig,'mvt'), 0);
        assert.equal(factory.getBufferSize(mapConfig,'grid.json'), 64);
    });

    it('should use value provided by mapConfig for png and mvt', function() {
        var mapConfig = MapConfig.create({
            buffersize: {
                png: 128,
                mvt: 128,
                'grid.json': 128
            },
            layers: [
                {
                    type: 'plain',
                    options: {
                        color: 'red'
                    }
           }]
        });
        var factory = new MapnikRendererFactory({mapnik: {
            bufferSize: 64,
            formatBufferSize: {
                png: 256,
                mvt: 256,
                'grid.json': 256
            }
        }});
        assert.equal(factory.getBufferSize(mapConfig,'png'), 128);
        assert.equal(factory.getBufferSize(mapConfig,'mvt'), 128);
        assert.equal(factory.getBufferSize(mapConfig,'grid.json'), 128);
    });
});
