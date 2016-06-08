require('../support/test_helper');

var assert = require('../support/assert');
var TestClient = require('../support/test_client');

describe('Create mapnik layergroup', function() {
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

    var mapnikLayer2 = {
        type: 'mapnik',
        options: {
            sql: 'select * from test_table_2 limit 2',
            cartocss_version: cartocssVersion,
            cartocss: cartocss
        }
    };

    var mapnikLayer3 = {
        type: 'mapnik',
        options: {
            sql: 'select * from test_table_3 limit 2',
            cartocss_version: cartocssVersion,
            cartocss: cartocss
        }
    };

    var mapnikLayer4 = {
        type: 'mapnik',
        options: {
            sql: [
                'select t1.cartodb_id, t1.the_geom, t2.address',
                ' from test_table t1, test_table_2 t2',
                ' where t1.cartodb_id = t2.cartodb_id;'
            ].join(''),
            cartocss_version: cartocssVersion,
            cartocss: cartocss
        }
    };

    var httpLayer = {
        type: 'http',
        options: {
            urlTemplate: 'http://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png',
            subdomains: ['a','b','c']
        }
    };

    function mapnikBasicLayerId(index) {
        return 'layer' + index;
    }
    function typeLayerId(type, index) {
        return type + '-' + mapnikBasicLayerId(index);
    }

    it('with one mapnik layer should response with meta-stats for that layer', function(done) {
        var testClient = new TestClient({
            version: '1.4.0',
            layers: [
                mapnikLayer1
            ]
        });

        testClient.createLayergroup(function(err, layergroup) {
            assert.ok(!err);
            assert.equal(layergroup.metadata.layers[0].id, mapnikBasicLayerId(0));
            assert.equal(layergroup.metadata.layers[0].meta.stats[0].features, 5);
            done();
        });
    });

    it('with two mapnik layer should response with meta-stats for every layer', function(done) {
        var testClient = new TestClient({
            version: '1.4.0',
            layers: [
                mapnikLayer1,
                mapnikLayer2
            ]
        });

        testClient.createLayergroup(function(err, layergroup) {
            assert.ok(!err);
            assert.equal(layergroup.metadata.layers[0].id, mapnikBasicLayerId(0));
            assert.equal(layergroup.metadata.layers[0].meta.stats[0].features, 5);
            assert.equal(layergroup.metadata.layers[1].id, mapnikBasicLayerId(1));
            assert.equal(layergroup.metadata.layers[1].meta.stats[0].features, 5);
            done();
        });
    });

    it('with three mapnik layer should response with meta-stats for every layer', function(done) {
        var testClient = new TestClient({
            version: '1.4.0',
            layers: [
                mapnikLayer1,
                mapnikLayer2,
                mapnikLayer3
            ]
        });

        testClient.createLayergroup(function(err, layergroup) {
            assert.ok(!err);
            assert.equal(layergroup.metadata.layers[0].id, mapnikBasicLayerId(0));
            assert.equal(layergroup.metadata.layers[0].meta.stats[0].features, 5);
            assert.equal(layergroup.metadata.layers[1].id, mapnikBasicLayerId(1));
            assert.equal(layergroup.metadata.layers[1].meta.stats[0].features, 5);
            assert.equal(layergroup.metadata.layers[2].id, mapnikBasicLayerId(2));
            assert.equal(layergroup.metadata.layers[2].meta.stats[0].features, 5);
            done();
        });
    });

    it('with one mapnik layer (sql with join) should response with meta-stats for that layer', function(done) {
        var testClient = new TestClient({
            version: '1.4.0',
            layers: [
                mapnikLayer4
            ]
        });

        testClient.createLayergroup(function(err, layergroup) {
            assert.ok(!err);
            assert.equal(layergroup.metadata.layers[0].id, mapnikBasicLayerId(0));
            assert.equal(layergroup.metadata.layers[0].meta.stats[0].features, 5);
            assert.equal(layergroup.metadata.layers[0].meta.stats[1].features, 5);
            done();
        });
    });

    it('with two mapnik layer (sql with join) should response with meta-stats for every layer', function(done) {
        var testClient = new TestClient({
            version: '1.4.0',
            layers: [
                mapnikLayer4,
                mapnikLayer4
            ]
        });

        testClient.createLayergroup(function(err, layergroup) {
            assert.ok(!err);
            assert.equal(layergroup.metadata.layers[0].id, mapnikBasicLayerId(0));
            assert.equal(layergroup.metadata.layers[0].meta.stats[0].features, 5);
            assert.equal(layergroup.metadata.layers[0].meta.stats[1].features, 5);
            assert.equal(layergroup.metadata.layers[1].id, mapnikBasicLayerId(1));
            assert.equal(layergroup.metadata.layers[1].meta.stats[0].features, 5);
            assert.equal(layergroup.metadata.layers[1].meta.stats[1].features, 5);
            done();
        });
    });

    it('with two mapnik layer (with & without join) should response with meta-stats for every layer', function(done) {
        var testClient = new TestClient({
            version: '1.4.0',
            layers: [
                mapnikLayer3,
                mapnikLayer4
            ]
        });

        testClient.createLayergroup(function(err, layergroup) {
            assert.ok(!err);
            assert.equal(layergroup.metadata.layers[0].id, mapnikBasicLayerId(0));
            assert.equal(layergroup.metadata.layers[0].meta.stats[0].features, 5);
            assert.ok(!layergroup.metadata.layers[0].meta.stats[1]);
            assert.equal(layergroup.metadata.layers[1].id, mapnikBasicLayerId(1));
            assert.equal(layergroup.metadata.layers[1].meta.stats[0].features, 5);
            assert.equal(layergroup.metadata.layers[1].meta.stats[1].features, 5);
            assert.ok(!layergroup.metadata.layers[1].meta.stats[2]);
            assert.ok(!layergroup.metadata.layers[2]);
            done();
        });
    });

    it('with mapnik and layer and httplayer should response with layer metadata with same order', function(done) {
        var testClient = new TestClient({
            version: '1.4.0',
            layers: [
                mapnikLayer1,
                httpLayer
            ]
        });

        testClient.createLayergroup(function(err, layergroup) {
            assert.ok(!err);
            assert.equal(layergroup.metadata.layers[0].id, mapnikBasicLayerId(0));
            assert.equal(layergroup.metadata.layers[0].type, 'mapnik');
            assert.equal(layergroup.metadata.layers[0].meta.stats[0].features, 5);
            assert.equal(layergroup.metadata.layers[1].id, typeLayerId('http', 0));
            assert.equal(layergroup.metadata.layers[1].type, 'http');
            done();
        });
    });

    it('with httpLayer and mapnik layer should response with layer metadata with same order', function(done) {
        var testClient = new TestClient({
            version: '1.4.0',
            layers: [
                httpLayer,
                mapnikLayer1
            ]
        });

        testClient.createLayergroup(function (err, layergroup) {
            assert.ok(!err);
            assert.equal(layergroup.metadata.layers[0].id, typeLayerId('http', 0));
            assert.equal(layergroup.metadata.layers[0].type, 'http');
            assert.ok(!layergroup.metadata.layers[0].meta.cartocss);
            assert.equal(layergroup.metadata.layers[1].meta.stats[0].features, 5);
            assert.equal(layergroup.metadata.layers[1].id, mapnikBasicLayerId(0));
            assert.equal(layergroup.metadata.layers[1].type, 'mapnik');
            assert.equal(layergroup.metadata.layers[1].meta.cartocss, cartocss);
            done();
        });
    });
});
