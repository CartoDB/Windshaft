var version = require('../../package.json').version;
var grainstore = require('grainstore');
var mapnik = require('mapnik');

module.exports = {
    Server: require('./server'),
    Datasource: require('./models/datasource'),
    tilelive: require('tilelive'),
    grainstore: grainstore,
    mapnik: mapnik,
    stats: {
        Client: require('./stats/client'),
        Profiler: require('./stats/profiler_proxy')
    },
    model: {
        Datasource: require('./models/datasource'),
        MapConfig: require('./models/mapconfig'),
        provider: {
            MapStoreMapConfig: require('./models/mapstore_mapconfig_provider')
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
