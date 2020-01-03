'use strict';

var version = require('../package.json').version;
var grainstore = require('grainstore');
var mapnik = require('@carto/mapnik');

module.exports = {
    grainstore: grainstore,
    mapnik: mapnik,
    model: {
        Datasource: require('./models/datasource'),
        MapConfig: require('./models/mapconfig'),
        provider: {
            MapStoreMapConfig: require('./models/providers/mapstore-mapconfig-provider')
        }
    },
    storage: {
        MapStore: require('./storages/mapstore')
    },
    cache: {
        RendererCache: require('./cache/renderer-cache')
    },
    renderer: {
        Factory: require('./renderers/renderer-factory')
    },
    backend: require('./backends'),
    version: version,
    versions: {
        windshaft: version,
        grainstore: grainstore.version(),
        node_mapnik: mapnik.version,
        mapnik: mapnik.versions.mapnik
    }
};
