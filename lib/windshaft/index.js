var version = require('../../package.json').version;
var grainstore = require('grainstore');
var mapnik = require('mapnik');
var tilelive = require('tilelive');

module.exports = {
    tilelive: tilelive,
    grainstore: grainstore,
    mapnik: mapnik,
    model: {
        Datasource: require('./models/datasource'),
        MapConfig: require('./models/mapconfig'),
        provider: {
            MapStoreMapConfig: require('./models/providers/mapstore_mapconfig_provider')
        }
    },
    storage: {
        MapStore: require('./storages/mapstore')
    },
    cache: {
        RendererCache: require('./cache/renderer_cache')
    },
    renderer: {
        Factory: require('./renderers/renderer_factory')
    },
    backend: {
        Attributes: require('./backends/attributes'),
        Map: require('./backends/map'),
        MapValidator: require('./backends/map_validator'),
        Preview: require('./backends/preview'),
        Tile: require('./backends/tile')
    },
    version: version,
    versions: {
        windshaft: version,
        grainstore: grainstore.version(),
        node_mapnik: mapnik.version,
        mapnik: mapnik.versions.mapnik
    }
};
