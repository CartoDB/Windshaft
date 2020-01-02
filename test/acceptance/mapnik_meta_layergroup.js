'use strict';

require('../support/test_helper');

var assert = require('../support/assert');
var TestClient = require('../support/test_client');

describe('Create mapnik layergroup', function () {
    before(function () {
        this.layerMetadataConfig = global.environment.enabledFeatures.layerMetadata;
        global.environment.enabledFeatures.layerMetadata = true;
    });

    after(function () {
        global.environment.enabledFeatures.layerMetadata = this.layerMetadataConfig;
    });

    var cartocssVersion = '2.3.0';
    var cartocss = '#layer { line-width:16; }';

    var mapnikLayer1 = {
        type: 'mapnik',
        options: {
            sql: 'select * from test_table limit 2',
            cartocss_version: cartocssVersion,
            cartocss: cartocss
        }
    };

    var httpLayer = {
        type: 'http',
        options: {
            urlTemplate: 'http://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png',
            subdomains: ['a', 'b', 'c']
        }
    };

    var mapnikLayerGeomColumn = {
        type: 'mapnik',
        options: {
            sql: 'select *, the_geom as my_geom from test_table_3 limit 2',
            geom_column: 'my_geom',
            cartocss_version: cartocssVersion,
            cartocss: cartocss
        }
    };

    function mapnikBasicLayerId (index) {
        return 'layer' + index;
    }
    function typeLayerId (type, index) {
        return type + '-' + mapnikBasicLayerId(index);
    }

    it('with mapnik and layer and httplayer should response with layer metadata with same order', function (done) {
        var testClient = new TestClient({
            version: '1.4.0',
            layers: [
                mapnikLayer1,
                httpLayer
            ]
        });

        testClient.createLayergroup(function (err, layergroup) {
            assert.ifError(err);
            assert.equal(layergroup.metadata.layers[0].id, mapnikBasicLayerId(0));
            assert.equal(layergroup.metadata.layers[0].type, 'mapnik');
            assert.equal(layergroup.metadata.layers[1].id, typeLayerId('http', 0));
            assert.equal(layergroup.metadata.layers[1].type, 'http');
            done();
        });
    });

    it('with httpLayer and mapnik layer should response with layer metadata with same order', function (done) {
        var testClient = new TestClient({
            version: '1.4.0',
            layers: [
                httpLayer,
                mapnikLayer1
            ]
        });

        testClient.createLayergroup(function (err, layergroup) {
            assert.ifError(err);
            assert.equal(layergroup.metadata.layers[0].id, typeLayerId('http', 0));
            assert.equal(layergroup.metadata.layers[0].type, 'http');
            assert.ok(!layergroup.metadata.layers[0].meta.cartocss);
            assert.equal(layergroup.metadata.layers[1].id, mapnikBasicLayerId(0));
            assert.equal(layergroup.metadata.layers[1].type, 'mapnik');
            assert.equal(layergroup.metadata.layers[1].meta.cartocss, cartocss);
            done();
        });
    });

    it('should work with different geom_column', function (done) {
        var testClient = new TestClient({
            version: '1.4.0',
            layers: [
                mapnikLayerGeomColumn
            ]
        });

        testClient.createLayergroup(function (err, layergroup) {
            assert.ifError(err);
            assert.equal(layergroup.metadata.layers[0].id, mapnikBasicLayerId(0));
            done();
        });
    });
});
